# Authentication

JWT bearer tokens, issued by `AuthService.login`/`register` and
validated by `JwtStrategy`. Passwords are hashed with bcrypt (12
rounds) — see `src/auth/auth.service.ts`.

There is no refresh token flow yet; tokens expire after 1 hour
(`JwtModule.registerAsync` in `src/auth/auth.module.ts`) and the
client must re-authenticate. `RolesGuard` exists for future
role-gated routes but isn't currently applied to any controller —
authorization today is handled per-resource (organization membership
checks in `OrganizationsService.assertMember`).

## Token validation

A token only proves who the caller was when it was issued. On every
request `JwtStrategy.validate` loads the user by the token's `sub`
(one primary-key lookup) and:

- rejects the token with `401` if the user no longer exists, so a
  deleted account cannot keep using a token until it expires;
- takes `email` and `role` from the database, not from the token, so a
  role change applies to the very next request (including for
  `RolesGuard`).

The token payload is unchanged (`sub`, `email`, `role`); its `role`
claim is informational only and never used for authorization.

## Password length

bcrypt hashes only the first 72 **bytes** of a password and silently
ignores the rest. `RegisterDto` therefore rejects passwords over 72
bytes with `400` instead of truncating them. The limit is measured in
UTF-8 bytes, not characters, so passwords with multi-byte characters
(accents, non-Latin scripts, emoji) reach it sooner. `LoginDto` does not
enforce the cap, so accounts registered before it existed can still
sign in.

## Organizer role

A user's `role` is `ORGANIZER` exactly when they are a member of at
least one live (not soft-deleted) organization. `PLATFORM_ADMIN` is
never changed by these rules, and ticket ownership is irrelevant:
holding tickets is what `ATTENDEE` already covers.

- **Promotion:** `OrganizationsService.create` promotes the creating
  `ATTENDEE` to `ORGANIZER`; `restore` promotes the organization's
  `ATTENDEE` members back.
- **Demotion:** `OrganizationsService.softDelete` demotes every member
  of that organization who has no other live membership to `ATTENDEE`.
  Soft-deleting an organization is currently the only way a user loses
  a membership; any future member-removal path must apply the same
  rule.

Each role update runs in the same transaction as the organization
write, as one set-based `UPDATE` over the organization's members.

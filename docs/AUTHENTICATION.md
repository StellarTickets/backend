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

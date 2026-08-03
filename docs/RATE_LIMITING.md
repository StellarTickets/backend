# Rate limiting

Not implemented yet. `/auth/login` and `/auth/register` are the
highest-priority endpoints to rate-limit (credential stuffing,
account enumeration) — `@nestjs/throttler` is the natural fit given
this is already a NestJS app. Tracked in `ROADMAP.md`.

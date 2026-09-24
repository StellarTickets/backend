# Rate limiting

## Ticket verification scans

`GET /tickets/verify/:qrSecret` is guarded by `ScanRateLimitGuard`
(`src/common/guards/scan-rate-limit.guard.ts`), a fixed-window velocity
limit keyed independently by:

- **requester IP** — catches one scanner (or attacker) hammering many
  different secrets, e.g. brute-forcing valid ticket ids.
- **the `qrSecret` being scanned** — catches one secret being replayed
  rapidly, e.g. a photographed or shared QR code being reused across
  multiple gates at once.

Either axis tripping the limit rejects the request with `429 Too Many
Requests`; a request only has to fail one check to be treated as abuse.

The IP comes from `req.ip`. Behind a load balancer or reverse proxy,
set `TRUST_PROXY` (see [`docs/DEPLOYMENT.md`](DEPLOYMENT.md#running-behind-a-proxy-trust_proxy)).
Without it, every client shares the proxy's IP and one busy gate can
rate-limit all the others.

Configurable via environment variables, both optional with defaults:

- `SCAN_RATE_LIMIT_MAX` (default `10`) — max attempts per window, per key.
- `SCAN_RATE_LIMIT_WINDOW_MS` (default `60000`) — window length in ms.

State is held in-process, which is enough for a single instance and for
tests. A multi-instance deployment would need this backed by something
shared (e.g. Redis) so the limit holds across instances — not needed for
the current single-instance deployment, but worth knowing before scaling
out horizontally.

## Auth endpoints

Not implemented yet. `/auth/login` and `/auth/register` are the
highest-priority endpoints to rate-limit (credential stuffing,
account enumeration) — `@nestjs/throttler` is the natural fit given
this is already a NestJS app. Tracked in `ROADMAP.md`.

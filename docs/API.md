# API surface

All API endpoints are versioned under URI prefix `/v1` (e.g. `/v1/auth/login`).

| Area | Base path |
|---|---|
| Health | `GET /v1/health` |
| Auth | `POST /v1/auth/register`, `POST /v1/auth/login` |
| Users | `GET /v1/users/me`, `PATCH /v1/users/me/wallet`, `GET /v1/users/lookup` |
| Organizations | `POST /v1/organizations`, `GET /v1/organizations/mine`, `GET /v1/organizations/:id` |
| Webhooks | `POST /v1/organizations/:id/webhooks`, `GET /v1/organizations/:id/webhooks`, `DELETE /v1/organizations/:id/webhooks/:webhookId` |
| Events | `GET /v1/events`, `GET /v1/events/:id`, `POST /v1/organizations/:id/events`, `POST /v1/events/:id/ticket-types`, `POST /v1/events/:id/publish` + `confirm-publish` |
| Tickets | `POST /v1/tickets/issue` \| `purchase` + confirm variants, `GET /v1/tickets/verify/:qrSecret`, `GET /v1/tickets/mine`, `GET /v1/tickets/resale`, `GET /v1/tickets/offline-public-keys`, `GET /v1/tickets/:ticketId/offline-token`, and per-ticket `transfer` / `check-in` / `revoke` / `list-resale` / `cancel-resale` / `buy-resale` + their `confirm-*` counterparts |

`GET /v1/organizations/:id/events` accepts an optional `?status=DRAFT|PUBLISHED|CANCELLED`
filter (any other value is a 400) and is paginated with `?page=` (1-based,
default `1`) and `?limit=` (default `20`, max `100`; out-of-range values are a
400). It returns `{ items, total, page, limit }`, newest first, where `total` is
the count across all pages for the applied filter. `POST /v1/organizations/:id/events` rejects a
`startsAt` more than a minute in the past (400), and `POST /v1/events/:id/publish`
returns 409 until the event has at least one ticket type.

Every `confirm-*` endpoint relays a wallet-signed XDR envelope
produced by the matching build endpoint — see the root README for the
full non-custodial flow.

`offline-public-keys` / `:ticketId/offline-token` support gate
verification with no network at the door — see
`docs/OFFLINE_VERIFICATION.md`.

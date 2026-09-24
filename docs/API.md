# API surface

| Area | Base path |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET /users/me`, `PATCH /users/me/wallet`, `GET /users/lookup` |
| Organizations | `POST /organizations`, `GET /organizations/mine`, `GET /organizations/:id` |
| Events | `GET /events`, `GET /events/:id`, `POST /organizations/:id/events`, `POST /events/:id/ticket-types`, `POST /events/:id/publish` + `confirm-publish` |
| Tickets | `POST /tickets/issue` \| `purchase` + confirm variants, `GET /tickets/verify/:qrSecret`, `GET /tickets/mine`, `GET /tickets/resale`, `GET /tickets/offline-public-keys`, `GET /tickets/:ticketId/offline-token`, and per-ticket `transfer` / `check-in` / `revoke` / `list-resale` / `cancel-resale` / `buy-resale` + their `confirm-*` counterparts |

`GET /organizations/:id/events` accepts an optional `?status=DRAFT|PUBLISHED|CANCELLED`
filter (any other value is a 400). `POST /organizations/:id/events` rejects a
`startsAt` more than a minute in the past (400), and `POST /events/:id/publish`
returns 409 until the event has at least one ticket type.

Every `confirm-*` endpoint relays a wallet-signed XDR envelope
produced by the matching build endpoint — see the root README for the
full non-custodial flow.

`offline-public-keys` / `:ticketId/offline-token` support gate
verification with no network at the door — see
`docs/OFFLINE_VERIFICATION.md`.

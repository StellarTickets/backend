# API surface

| Area | Base path |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET /users/me`, `PATCH /users/me/wallet`, `GET /users/lookup` |
| Organizations | `POST /organizations`, `GET /organizations/mine`, `GET /organizations/:id` |
| Events | `GET /events`, `GET /events/:id`, `POST /organizations/:id/events`, `POST /events/:id/ticket-types`, `POST /events/:id/publish` + `confirm-publish` |
| Tickets | `POST /tickets/issue` \| `purchase` + confirm variants, `GET /tickets/verify/:qrSecret`, `GET /tickets/mine`, `GET /tickets/resale`, and per-ticket `transfer` / `check-in` / `revoke` / `list-resale` / `cancel-resale` / `buy-resale` + their `confirm-*` counterparts |

Every `confirm-*` endpoint relays a wallet-signed XDR envelope
produced by the matching build endpoint — see the root README for the
full non-custodial flow.

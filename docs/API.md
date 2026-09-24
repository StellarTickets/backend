# API surface

| Area | Base path |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET /users/me`, `PATCH /users/me/wallet`, `GET /users/lookup` |
| Organizations | `POST /organizations`, `GET /organizations/mine`, `GET /organizations/:id` |
| Events | `GET /events`, `GET /events/:id`, `POST /organizations/:id/events`, `POST /events/:id/ticket-types`, `POST /events/:id/publish` + `confirm-publish` |
| Tickets | `POST /tickets/issue` \| `purchase` + confirm variants, `GET /tickets/verify/:qrSecret`, `GET /tickets/mine`, `GET /tickets/resale`, `GET /tickets/offline-public-keys`, `GET /tickets/:ticketId/offline-token`, and per-ticket `transfer` / `check-in` / `revoke` / `list-resale` / `cancel-resale` / `buy-resale` + their `confirm-*` counterparts |

Every `confirm-*` endpoint relays a wallet-signed XDR envelope
produced by the matching build endpoint — see the root README for the
full non-custodial flow.

`offline-public-keys` / `:ticketId/offline-token` support gate
verification with no network at the door — see
`docs/OFFLINE_VERIFICATION.md`.

## Pagination

Offset-paginated listings take `?page=&limit=` (`PaginationQueryDto`,
`src/common/dto/pagination-query.dto.ts`):

| Param | Default | Rules |
|---|---|---|
| `page` | `1` | integer ≥ 1 (1-based) |
| `limit` | `20` | integer 1–100 |

An out-of-range value is rejected with `400`. The response body is a
`Paginated<T>` (`src/common/pagination/paginated.ts`):

```json
{ "items": [ ... ], "total": 57, "page": 2, "limit": 20 }
```

`total` counts matching rows across all pages. A page past the end
returns `items: []` with the real `total`.

Currently paginated: `GET /events` (published events, ordered by
`startsAt` then `id` so rows don't shift between pages).
`GET /tickets/resale` uses cursor pagination instead
(`?cursor=&limit=` → `{ items, nextCursor, limit }`).

To paginate a new endpoint, accept `@Query() query: PaginationQueryDto`,
have the service return `prisma.$transaction([findMany({ ...toSkipTake(query) }), count()])`,
and add `@UseInterceptors(PaginatedResponseInterceptor)` to the handler. The
interceptor turns the `[items, total]` result into a `Paginated<T>` body.
Handlers can also build the body directly with `paginate(items, total, query)`.

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

## Conditional GET (ETags)

Every `GET` response carries a weak `ETag` (`W/"..."`), computed by
Express from the response body (`app.set('etag', 'weak')` in
`src/app.setup.ts`). A client that re-sends it as `If-None-Match` gets
`304 Not Modified` with an empty body while the response is unchanged,
so polling `GET /events` does not re-download an identical list:

```http
GET /events
→ 200  ETag: W/"1a2-Lx0..."

GET /events
If-None-Match: W/"1a2-Lx0..."
→ 304  (no body)
```

The ETag is a hash of the serialized response, so it changes whenever
any event on the page, or the page's `total`, changes. The server still
runs the query to compute it: the saving is bandwidth and client-side
parsing, not database work.


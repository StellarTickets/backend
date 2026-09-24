# Changelog

All notable changes to the backend API are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Auth (register/login, JWT)
- Organizations, events, ticket types
- Non-custodial ticket lifecycle: issue, purchase, transfer, check-in,
  revoke, resale marketplace
- Users module: profile, wallet connect, email lookup
- Shared `PaginationQueryDto` (`?page=&limit=`, default 20, max 100) and
  `Paginated<T>` response body (`items`, `total`, `page`, `limit`) with a
  `PaginatedResponseInterceptor`; see docs/API.md
- Weak ETags on GET responses; a matching `If-None-Match` returns `304`
- `TRUST_PROXY` env var for Express `trust proxy`; see docs/DEPLOYMENT.md

### Changed
- `GET /events` is paginated and returns `{ items, total, page, limit }`
  instead of a bare array

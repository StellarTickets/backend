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
- `GET /organizations/:id/events` is paginated (`?page=`, `?limit=`) and returns
  `{ items, total, page, limit }`; shared `PaginationQueryDto`
- Cache abstraction with memory and Redis drivers (`CACHE_DRIVER`)
- Optional BullMQ queue for outbound webhooks (`WEBHOOK_QUEUE_ENABLED`, off by default)
- Scheduler module with a sample cron job (`SCHEDULER_ENABLED`)

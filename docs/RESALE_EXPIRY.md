# Resale Listing Expiry, Limits, and Audit History

## Overview

This document describes the resale marketplace enhancements implemented for resale listings on StellarTickets.

## Features

### 1. Resale Listing Expiration (`expiresAt`)

- Sellers can optionally provide an expiration timestamp (`expiresAt`) when creating a resale listing.
- The `ResaleExpiryService` periodically inspects active resale listings where `expiresAt <= now()`.
- `list_for_resale` carries no expiry, so the contract keeps an expired listing live until the seller signs `cancel_resale`. Each expired listing is therefore checked against the chain with `verify_ticket` (#503):
  - **Still `Resale` on chain:** the listing stays `ACTIVE` and the ticket `RESALE`, since it can still be bought. The seller is emailed once (`expiryNotifiedAt`) asking them to cancel it from their wallet.
  - **No longer listed on chain** (cancelled, sold, used or revoked there): the listing becomes `CANCELLED` and the ticket takes its on-chain status.
  - **The chain can't be read:** nothing changes for that listing, and the next run retries it.

  The database therefore never marks a ticket `VALID` while the chain still has it listed.

### 2. Configurable Soft Limit Cap

- Prevents sellers from flooding the marketplace with excessive listings.
- Configured via the `MAX_ACTIVE_RESALE_LISTINGS_PER_USER` environment variable (default: `5`).
- Listing creation requests exceeding this limit throw an HTTP 409 (`ConflictException`).

### 3. Resale Price History Audit

- Every price set or updated on a resale listing is recorded in the `ResalePriceHistory` audit table.
- Accessible via the `GET /tickets/resale/:listingId/price-history` endpoint.
- Updated on chain and then in the database: `POST /tickets/resale/:listingId/price` builds a `list_for_resale` at the new price, and `PATCH` with the signed envelope submits it and records the price the chain stored (#502).

## Limitations

- **Expiry cannot delist on chain by itself.** `expiresAt` never reaches the `ticketing` contract, and only the owner can sign `cancel_resale`. Until they do, an expired listing remains buyable on chain and stays `ACTIVE` here. Making expiry enforceable on chain needs a contract change (an expiry argument to `list_for_resale`).
- **Buying an expired listing is possible until the next expiry run.** The expiry job runs every 60 seconds, and `buy-resale` gates only on the ticket's database status being `RESALE`. Between `expiresAt` and the next run, the API still builds a buy transaction for the listing.
- **Expiry is a timer in each API process.** `ResaleExpiryService` starts on boot and runs every 60 seconds. It is registered in `TicketsModule`, so `SCHEDULER_ENABLED=false` does not turn it off. Every instance runs it. `POST /v1/tickets/resale/cancel-expired` runs the same cancel on demand.
- **The owner must clean up the chain.** Nothing in the API cancels the on-chain listing on the seller's behalf. The owner has to call `cancel-resale` and sign the transaction. The API cannot do this for them.
- **The listing limit counts database rows.** `MAX_ACTIVE_RESALE_LISTINGS_PER_USER` is checked against `ACTIVE` rows. Since #503, an expired listing that is still live on chain stays `ACTIVE`, so it keeps counting until the seller cancels it.

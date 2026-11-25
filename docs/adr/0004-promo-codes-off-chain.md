# 0004 — Promo codes are settled off-chain via issue_ticket

**Status:** Accepted

## Context

The Soroban `ticketing` contract's `purchase_primary` instruction charges the
buyer exactly the tier price that the organizer registered with `create_event`.
The contract has no parameter for a discounted price and no concept of promo
codes. When the backend previously passed `discountedPrice` to
`buildPurchasePrimaryTx`, the unsigned envelope embedded that lower amount.
The contract would still settle at the full tier price, so either:

- the buyer's wallet signed an envelope for the discounted amount and the
  contract rejected it (or charged the full price silently), or
- the promo code was consumed by `redeem()` even though the buyer paid full
  price on-chain.

Neither outcome is acceptable.

## Decision

Promo codes **cannot be applied to the on-chain `purchase_primary` flow**.

`buildPurchaseTx` and `confirmPurchase` now reject any request that includes a
`promoCode` with HTTP 400 and an explanatory message directing the buyer to ask
the organizer to issue the ticket directly.

Discounted tickets must go through the organizer-authorised **`issue_ticket`**
flow:

1. Organizer validates the promo code out-of-band (or the platform validates
   it via `POST /promo-codes/:eventId/preview`).
2. Organizer calls `POST /tickets/issue` → user signs → `POST /tickets/confirm-issue`.
3. The organizer pays the tier price to the contract as the issuer; the
   monetary settlement between organiser and buyer is handled off-chain
   (payment gateway, invoice, etc.).

## Consequences

- Buyers cannot self-serve a discounted purchase through the standard
  `purchase_primary` path. This is a known UX trade-off; organizers must
  either issue tickets directly or integrate an off-chain payment flow.
- The `promoCode` field on `PurchasePrimaryDto` and `ConfirmPurchasePrimaryDto`
  is kept in the schema so existing clients don't break at the DTO validation
  layer, but the service now returns a clear 400 if it is non-empty.
- `PromoCodesService.validate` and `redeem` remain intact for future use if an
  on-chain discount primitive becomes available (e.g. an organizer-signed
  voucher passed as a contract argument).

## Revisit if

- The Soroban contract is extended with a verifiable discount argument that the
  buyer can include in their `purchase_primary` invocation (e.g. an
  organizer-signed ECDSA voucher checked inside the contract).
- An L2 or escrow pattern emerges that lets the platform atomically refund the
  price difference after a full-price purchase completes on-chain.

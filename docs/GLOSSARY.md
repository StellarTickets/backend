# Glossary

- **Organization** — an issuer account (venue, airline, promoter,
  etc.) that owns events and signs on-chain writes for them.
- **Event** — a concert, flight, match, etc; owns ticket types and a
  resale policy, mirrored on-chain via `chainEventId`.
- **TicketType** — a tier (GA, VIP) with a face-value price and a
  fixed quantity, scoped to one event.
- **Ticket** — one issued asset, mirrored on-chain via `chainTicketId`;
  `qrSecret` is the opaque code embedded in its scannable code.
- **ResaleListing** — an active/sold/cancelled record of a ticket
  being offered on the marketplace.
- **build/confirm pair** — the two-step non-custodial pattern every
  on-chain write follows; see `docs/ARCHITECTURE.md`.

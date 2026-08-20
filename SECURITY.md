# Security Policy

## Reporting a vulnerability

This API never stores user private keys and relies on the
`ticketing` Soroban contract as the source of truth for ticket
ownership (see [stellar/blockchain](https://github.com/StellarTickets/blockchain)).
If you find an authorization bypass, an injection vector, or a way to
forge a JWT, please report it privately through the StellarTickets
GitHub organization rather than opening a public issue.

## Supported versions

| Version | Supported |
|---|---|
| 0.0.x | :white_check_mark: |

# Deployment checklist

1. `npx tsc --noEmit` — clean typecheck
2. `npx eslint "src/**/*.ts"` — no lint warnings
3. `npm test` — full suite green
4. `npx prisma migrate deploy` against the production database
5. Set `TICKETING_CONTRACT_ID` to the mainnet-deployed contract address
6. Set `STELLAR_NETWORK=mainnet` and a production `SOROBAN_RPC_URL`
7. Rotate `JWT_SECRET` and `PLATFORM_SIGNER_SECRET` out of any shared
   `.env` file into a real secrets manager before going live
8. Set `TRUST_PROXY` to match the load balancer / reverse proxy in front
   of the app (see below)

## Running behind a proxy (`TRUST_PROXY`)

Behind a load balancer or reverse proxy, every request reaches the app
from the proxy's address. Unless Express is told to trust that proxy,
`req.ip` is the proxy's IP, so the per-IP scan rate limit
([`docs/RATE_LIMITING.md`](RATE_LIMITING.md)) puts every client in one
bucket and logs show one address.

`TRUST_PROXY` sets Express's
[`trust proxy`](https://expressjs.com/en/guide/behind-proxies.html)
setting, which decides how much of `X-Forwarded-For` to believe when
resolving `req.ip`:

| Value | Meaning |
|---|---|
| unset, empty or `false` (default) | Ignore `X-Forwarded-For`. Correct when clients connect directly. |
| `1`, `2`, ... | Trust that many proxy hops in front of the app. `1` is right for a single load balancer (e.g. Render, Fly.io, an nginx in front of the container). |
| `10.0.0.0/8,loopback` | Trust only these proxy addresses: IPs, CIDR ranges (or `ip/netmask`) and the presets `loopback`, `linklocal`, `uniquelocal`, comma-separated. The strictest option when proxy IPs are known. |
| `true` | Trust every hop. Only safe if the app cannot be reached except through the proxy. Otherwise any client can pick its own IP by sending `X-Forwarded-For`. |

An invalid value (e.g. `on`, `10.0.0.0/33`) fails env validation at boot.

Set the hop count or address list to exactly what sits in front of the
app. Trusting more hops than exist lets clients spoof the IP the rate
limiter keys on.


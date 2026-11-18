An invalid value (e.g. `one`, `10.0.0.0/33`) fails env validation at boot.

**Boot warning:** If `TRUST_PROXY` is unset or `false`, the application logs a warning at startup. This is intentional for direct-client deployments but must be configured when running behind a proxy/load balancer so that rate limiting and logs use the real client IP.

Set the hop count or address list to exactly what sits in front of the
app. Trusting more hops than exist lets clients spoof the IP the rate
limiter keys on.

# Observability

There's no structured logging or metrics pipeline wired up yet —
Nest's default console logger is all that's active. Before a real
production deploy, prioritize:

1. Structured request logging (method, path, status, latency) via an
   interceptor
2. Error tracking (e.g. Sentry) on unhandled exceptions
3. A dashboard for `StellarService` call latency/failure rate, since
   that's the module most exposed to external (Soroban RPC) failure

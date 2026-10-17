# Observability

## Structured Logging (`nestjs-pino`)

The application uses `nestjs-pino` with `pino-http` for low-overhead, JSON-structured logging in production and development.

### Request ID Correlation (`X-Request-Id`)
Every incoming HTTP request is assigned a unique `X-Request-Id` (or preserves an incoming client-provided `X-Request-Id` header).
- **Responses:** The `X-Request-Id` header is attached to all HTTP responses (success and error).
- **Error Bodies:** All error response payloads (e.g. 400, 404, 500) include `requestId` in the JSON body.
- **Log Correlation:** Every log entry emitted during the request lifecycle carries the `req.id` matching `X-Request-Id`.

### Secret Redaction
Sensitive fields and headers are automatically redacted by Pino's built-in serializer before writing to stdout:
- `req.headers.authorization` (JWT and Bearer tokens)
- `req.headers.cookie`
- `req.headers["x-api-key"]`

### Configurable Log Level (`LOG_LEVEL`)
Logging verbosity is controlled via the `LOG_LEVEL` environment variable.
Valid levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.
- **Production default:** `info`
- **Development default:** `debug`
- **Test default:** `silent`

```bash
# Example in .env
LOG_LEVEL=info
```

## Prioritized Next Steps
1. Error tracking (e.g. Sentry) on unhandled exceptions
2. A dashboard for `StellarService` call latency/failure rate, since that's the module most exposed to external (Soroban RPC) failure

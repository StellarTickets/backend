# Error handling

`GlobalExceptionFilter` is registered in `src/main.ts` and handles every
uncaught exception at the HTTP boundary. Known Nest HTTP exceptions retain
Nest's `{ statusCode, message, error }` response shape. Unexpected errors are
sanitised and returned as:

```json
{
  "statusCode": 500,
  "code": "INTERNAL_ERROR",
  "message": "Internal server error",
  "error": "Internal Server Error",
  "requestId": "<request id>"
}
```

The request id is taken from `X-Request-Id` when supplied; otherwise the
filter generates one. Unexpected errors are logged server-side with the
request method and URL, but their internal message and stack are never
exposed to callers.

`ValidationPipe` (registered globally in `main.ts`) rejects any
request body that doesn't match its DTO's `class-validator` decorators
before the request ever reaches a controller method.

Prisma and domain errors are mapped to stable status codes and public error
messages by the same filter. See `docs/OBSERVABILITY.md` for production
monitoring guidance.

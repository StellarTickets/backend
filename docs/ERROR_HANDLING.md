# Error handling

Nest's built-in HTTP exception filter handles everything — services
throw `NotFoundException`, `ForbiddenException`, `ConflictException`,
`BadRequestException`, etc. from `@nestjs/common`, and Nest serializes
them to `{ statusCode, message, error }` automatically.

`ValidationPipe` (registered globally in `main.ts`) rejects any
request body that doesn't match its DTO's `class-validator` decorators
before the request ever reaches a controller method.

There's no custom global exception filter yet — see
`docs/OBSERVABILITY.md` for what's still missing before a production
deploy (structured error logging in particular).

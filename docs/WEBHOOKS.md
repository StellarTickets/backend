# Outbound webhook queue

Delivering a webhook inline ties the outcome of a request to a third party's
endpoint being fast and up. The webhook queue (`src/webhooks/`) moves delivery
out of band: a caller hands a delivery to the queue and carries on, and a
background worker sends it, retrying failures.

It is **optional and disabled by default**. With it off nothing is queued or
sent, Redis is not needed, and the `bullmq` package need not be installed.

## Enabling

1. Install the queue library (only loaded when the queue is enabled):

   ```bash
   npm install bullmq
   ```

2. Turn it on and point it at Redis:

   ```bash
   WEBHOOK_QUEUE_ENABLED=true
   REDIS_URL=redis://localhost:6379
   ```

   `REDIS_URL` is required when the queue is enabled — the app refuses to start
   without it. Use `rediss://` for TLS and put credentials in the URL. For a
   local Redis: `docker run --rm -p 6379:6379 redis:7`.

   BullMQ needs Redis configured with `maxmemory-policy noeviction`; with an
   eviction policy Redis may silently drop queued jobs under memory pressure.

| Variable | Default | Meaning |
|---|---|---|
| `WEBHOOK_QUEUE_ENABLED` | `false` | `true` turns the queue on. |
| `REDIS_URL` | — | Required when enabled. |
| `WEBHOOK_QUEUE_ATTEMPTS` | `5` | Total attempts per webhook, the first included. |
| `WEBHOOK_QUEUE_BACKOFF_MS` | `5000` | Delay before the first retry; doubles each retry (5s, 10s, 20s, 40s). |

## Sending a webhook

Import `WebhooksModule` and inject the queue:

```ts
@Module({ imports: [WebhooksModule], providers: [MyService] })
export class MyModule {}

@Injectable()
export class MyService {
  constructor(@Inject(WEBHOOK_QUEUE) private readonly webhooks: WebhookQueue) {}

  async notify(ticketId: string) {
    const queued = await this.webhooks.enqueue({
      url: 'https://example.com/hooks',
      event: 'ticket.issued',
      payload: { ticketId },
    });
    // `queued` is false when the queue is disabled: nothing was sent.
  }
}
```

`enqueue` resolves `true` once the delivery is stored in Redis and `false` when
the queue is disabled, so a caller can tell "queued" from "not sent". It rejects
if the URL is not `http`/`https` or Redis is unreachable — catch that where a
Redis outage must not fail the request.

## Delivery

The worker POSTs `{ "event": "...", "payload": ... }` as JSON, with an
`X-Webhook-Event` header, and expects a `2xx` within 10 seconds. Anything else —
a non-2xx status, a redirect, a timeout, a network error — counts as a failure
and is retried with exponential backoff until the attempts run out.

- **At-least-once.** A delivery whose response was lost is retried, so endpoints
  must tolerate duplicates.
- **Redirects are not followed**, and count as failures.
- Finished jobs are kept for an hour (up to 1,000) and failed ones for 7 days, so
  exhausted deliveries can be inspected in Redis. Only the target host is
  logged; the path and query of a URL can carry a secret.
- The worker runs inside every app instance (5 jobs at a time each); BullMQ
  makes each job run on exactly one of them. It is closed, finishing in-flight
  deliveries first, when the Nest application is closed.
- Redis errors are logged (`Webhook queue error` / `Webhook worker error`) rather
  than crashing the process.

## Not included

Payload signing, per-organization subscriptions and a dead-letter view are not
part of this queue; it is the delivery mechanism they would build on.

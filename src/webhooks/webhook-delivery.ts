import type { WebhookDelivery } from './webhook-queue';

export const WEBHOOK_TIMEOUT_MS = 10_000;

interface DeliverOptions {
  /** Injectable so tests don't hit the network. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Performs one delivery attempt. Anything but a 2xx — including a timeout, a
 * network error or a redirect — throws, which is what makes the queue retry.
 */
export async function deliverWebhook(
  delivery: WebhookDelivery,
  { fetchImpl = fetch, timeoutMs = WEBHOOK_TIMEOUT_MS }: DeliverOptions = {},
): Promise<void> {
  const response = await fetchImpl(delivery.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-event': delivery.event,
    },
    body: JSON.stringify({ event: delivery.event, payload: delivery.payload }),
    signal: AbortSignal.timeout(timeoutMs),
    // Never follow a redirect to somewhere the caller didn't ask for.
    redirect: 'manual',
  });

  if (!response.ok) {
    throw new Error(`Webhook endpoint responded with HTTP ${response.status}`);
  }
}

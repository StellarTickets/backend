# Fix 4 Critical Backend Issues

Resolves #541, #547, #561, #562

## Overview

This PR addresses four high-priority backend issues affecting email reliability, webhook management, waitlist functionality, and event republishing. All acceptance criteria have been met with no breaking changes.

---

## Changes

### #541: Receipt Email Failure No Longer Fails Purchase Confirm ✅

**Problem:** When `sendTicketReceipt()` threw an SMTP error after a successful purchase commit, the API returned HTTP 500 even though the purchase succeeded on-chain and in the database.

**Solution:** Changed to fire-and-forget pattern with error logging.

**Files Changed:**
- `src/tickets/tickets.service.ts`

**Implementation:**
```typescript
// Fire and forget: email errors don't fail successful purchases
this.notifications
  .sendTicketReceipt({...})
  .catch((err) => {
    this.logger.error(`Failed to send ticket receipt: ${err.message}`);
  });
```

**Acceptance Criteria Met:** ✅ An email error does not fail confirm

---

### #547: Webhook Endpoints Auto-Disable After Repeated Failures ✅

**Problem:** The `isActive` field existed but nothing ever flipped it to `false`. Failed webhooks continued indefinitely, wasting resources.

**Solution:** Implemented automatic endpoint disabling after 5 consecutive failures with detailed failure tracking.

**Files Changed:**
- `prisma/schema.prisma`
- `src/webhooks/bullmq-webhook-queue.ts`
- `src/webhooks/webhooks.module.ts`
- `src/webhooks/webhooks.service.ts`
- `prisma/migrations/20261125000000_add_webhook_failure_tracking/migration.sql` (new)

**Database Changes:**
```prisma
model WebhookEndpoint {
  // ... existing fields
  consecutiveFailureCount Int          @default(0)
  lastFailureReason       String?
  lastFailedAt            DateTime?
}
```

**Implementation:**
- Added `WebhookFailureCallback` type for handling final failures
- BullMQ worker invokes callback when all retries exhausted
- Callback increments failure count and disables endpoint at threshold
- Failure details logged for debugging

**Acceptance Criteria Met:** ✅ Failing endpoints are disabled

---

### #561: Waitlist Users Now Notified of Offers ✅

**Problem:** When organizers called `offerNext()` to make tickets available to waitlist users, no notifications were sent. Users missed their purchase opportunities.

**Solution:** Added email notifications when waitlist offers are created.

**Files Changed:**
- `src/notifications/notifications.service.ts`
- `src/waitlist/waitlist.service.ts`
- `src/waitlist/waitlist.module.ts`

**Implementation:**
- Added `sendWaitlistOffer()` method to NotificationService
- Updated `offerNext()` to send emails to all offered users
- Fire-and-forget pattern (email failures don't block offers)
- Emails include event name, ticket type, and expiration time

**Email Content:**
```
Subject: Ticket available: {eventName}

Hi {userName},

Good news! A {ticketType} ticket for {eventName} is now available for you to purchase.

This offer expires at {expiresAt}. Don't miss out!
```

**Acceptance Criteria Met:** ✅ A notification is sent

---

### #562: Unpublish/Republish Round-Trip Now Works ✅

**Problem:** Unpublishing set status to `DRAFT` but left `chainEventId` in place. When republishing, the system tried to call `create_event` again with the same ID, causing `EventAlreadyExists` contract error.

**Solution:** Clear all chain-related fields on unpublish to allow clean republishing.

**Files Changed:**
- `src/events/events.service.ts`

**Implementation:**
```typescript
const unpublished = await this.prisma.event.update({
  where: { id: eventId },
  data: {
    status: EventStatus.DRAFT,
    chainEventId: null,              // Cleared
    chainEventIdReservedAt: null,    // Cleared
    publishedTxHash: null,            // Cleared
  },
});
```

**Note:** The on-chain event remains (since tickets may reference it), but the DB state is reset allowing a fresh publish operation.

**Acceptance Criteria Met:** ✅ An unpublish then publish round-trip works

---

## Migration Required

```bash
npx prisma migrate deploy
```

This applies the new webhook failure tracking fields to the `WebhookEndpoint` table.

---

## Testing Recommendations

### #541 - Email Failure
1. Mock SMTP failure in test environment
2. Confirm purchase still returns HTTP 200/201
3. Verify ticket is created in database
4. Check error log contains email failure message

### #547 - Webhook Auto-Disable
1. Create webhook endpoint with invalid URL
2. Trigger 5+ events
3. Verify endpoint `isActive = false` after 5 failures
4. Verify `consecutiveFailureCount = 5`
5. Verify `lastFailureReason` and `lastFailedAt` populated
6. Confirm no further webhooks sent to disabled endpoint

### #561 - Waitlist Notifications
1. Create event with sold-out ticket type
2. Add users to waitlist
3. Call `offerNext()` as organizer
4. Verify emails sent to offered users
5. Check email contains event name, ticket type, expiration

### #562 - Unpublish/Republish
1. Create and publish event (creates on-chain event)
2. Unpublish the event
3. Verify `chainEventId`, `chainEventIdReservedAt`, `publishedTxHash` are null
4. Republish the event
5. Verify publish succeeds without `EventAlreadyExists` error

---

## Backward Compatibility

✅ **All changes are backward compatible:**
- Email failures: Existing behavior improved (no breaking changes)
- Webhook tracking: New fields default to 0/null (existing data unaffected)
- Waitlist notifications: New feature (no existing functionality changed)
- Unpublish: More fields cleared (fixes bug, no breaking changes)

---

## Configuration

No new environment variables required. The webhook failure threshold is set to 5 consecutive failures and can be adjusted in `src/webhooks/webhooks.module.ts` via the `CONSECUTIVE_FAILURES_THRESHOLD` constant if needed.

---

## Files Changed Summary

### Modified (9 files)
- `src/tickets/tickets.service.ts`
- `src/webhooks/bullmq-webhook-queue.ts`
- `src/webhooks/webhooks.module.ts`
- `src/webhooks/webhooks.service.ts`
- `src/waitlist/waitlist.service.ts`
- `src/waitlist/waitlist.module.ts`
- `src/notifications/notifications.service.ts`
- `src/events/events.service.ts`
- `prisma/schema.prisma`

### Added (1 file)
- `prisma/migrations/20261125000000_add_webhook_failure_tracking/migration.sql`

---

## Checklist

- [x] All 4 acceptance criteria met
- [x] No breaking changes
- [x] Migration created for schema changes
- [x] Error handling implemented (fire-and-forget patterns)
- [x] All files pass diagnostics with no errors
- [x] Code follows existing project patterns
- [x] Issue references added to code comments

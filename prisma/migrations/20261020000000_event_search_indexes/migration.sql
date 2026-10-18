-- Public event search (GET /events): filters PUBLISHED events by optional
-- category and startsAt range, ordered by startsAt.
-- Supports: WHERE "status" = $1 [AND "startsAt" BETWEEN $2 AND $3] ORDER BY "startsAt".
CREATE INDEX IF NOT EXISTS "Event_status_startsAt_idx"
  ON "Event"("status", "startsAt");
-- Supports: WHERE "status" = $1 AND "category" = $2 [AND "startsAt" ...] ORDER BY "startsAt".
CREATE INDEX IF NOT EXISTS "Event_status_category_startsAt_idx"
  ON "Event"("status", "category", "startsAt");

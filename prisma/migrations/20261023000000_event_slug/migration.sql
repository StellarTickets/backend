ALTER TABLE "Event"
ADD COLUMN "slug" TEXT;

UPDATE "Event"
SET "slug" =
  COALESCE(
    NULLIF(
      trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'event'
  )
  || '-' || to_char("startsAt", 'YYYY-MM-DD')
  || '-' || "id";

ALTER TABLE "Event"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

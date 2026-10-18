-- Existing events predate these required display fields. Backfill them before
-- dropping the temporary defaults so all future writes must provide values.
ALTER TABLE "Event"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE "Event"
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "timezone" DROP DEFAULT;

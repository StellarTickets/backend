-- #387 — normalize existing user emails to lowercase and trimmed.
UPDATE "User"
SET "email" = LOWER(TRIM("email"))
WHERE "email" != LOWER(TRIM("email"));

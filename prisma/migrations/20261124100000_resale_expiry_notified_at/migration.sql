-- #503: when the seller of an expired listing that is still listed on chain
-- was asked to sign cancel_resale, so they are asked once, not every run.
ALTER TABLE "ResaleListing" ADD COLUMN "expiryNotifiedAt" TIMESTAMP(3);

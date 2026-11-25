-- #515: a scanner device's own Stellar key, registered on chain with
-- add_checkin_signer so it can sign check_in without the organizer key.
ALTER TABLE "ScannerDevice"
ADD COLUMN "stellarPublicKey" TEXT,
ADD COLUMN "signerRegisteredAt" TIMESTAMP(3);

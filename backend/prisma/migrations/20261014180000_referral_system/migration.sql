-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "referralEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "referralReferrerCoins" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "referralRefereeCoins" INTEGER NOT NULL DEFAULT 25;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "referrerCoins" INTEGER NOT NULL DEFAULT 50,
    "refereeCoins" INTEGER NOT NULL DEFAULT 25,
    "completedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- Backfill referralCode for existing users uniquely
DO $$
DECLARE
    r RECORD;
    new_code TEXT;
    chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    i INT;
BEGIN
    FOR r IN SELECT id FROM "User" WHERE "referralCode" IS NULL LOOP
        LOOP
            new_code := 'HAAT';
            FOR i IN 1..4 LOOP
                new_code := new_code || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INT, 1);
            END LOOP;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "referralCode" = new_code);
        END LOOP;
        UPDATE "User" SET "referralCode" = new_code WHERE id = r.id;
    END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_orderId_key" ON "Referral"("orderId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_refereeId_idx" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_orderId_idx" ON "Referral"("orderId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

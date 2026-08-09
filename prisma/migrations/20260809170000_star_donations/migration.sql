-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'PRECHECKOUT', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "telegram_users" ADD COLUMN     "donateAwaitingAmount" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "amountStars" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XTR',
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "invoicePayload" TEXT NOT NULL,
    "telegramPaymentChargeId" TEXT,
    "providerPaymentChargeId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donations_invoicePayload_key" ON "donations"("invoicePayload");

-- CreateIndex
CREATE UNIQUE INDEX "donations_telegramPaymentChargeId_key" ON "donations"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "donations_telegramUserId_createdAt_idx" ON "donations"("telegramUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "donations_status_createdAt_idx" ON "donations"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "donations_createdAt_idx" ON "donations"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "telegram_users"("telegramId") ON DELETE SET NULL ON UPDATE CASCADE;


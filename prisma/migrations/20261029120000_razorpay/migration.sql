-- CreateEnum
CREATE TYPE "RazorpayPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "RazorpayChannel" AS ENUM ('WEB', 'TELEGRAM');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "razorpayPaymentId" TEXT;

-- CreateTable
CREATE TABLE "razorpay_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramId" TEXT,
    "plan" "PremiumPlan" NOT NULL,
    "channel" "RazorpayChannel" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "referenceId" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentLinkId" TEXT,
    "shortUrl" TEXT,
    "paymentId" TEXT,
    "status" "RazorpayPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "flagReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "razorpay_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razorpay_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "entityId" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_payments_referenceId_key" ON "razorpay_payments"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_payments_orderId_key" ON "razorpay_payments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_payments_paymentLinkId_key" ON "razorpay_payments"("paymentLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_payments_paymentId_key" ON "razorpay_payments"("paymentId");

-- CreateIndex
CREATE INDEX "razorpay_payments_userId_plan_channel_status_idx" ON "razorpay_payments"("userId", "plan", "channel", "status");

-- CreateIndex
CREATE INDEX "razorpay_payments_status_createdAt_idx" ON "razorpay_payments"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "razorpay_payments_status_expiresAt_idx" ON "razorpay_payments"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "razorpay_payments_createdAt_idx" ON "razorpay_payments"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_webhook_events_eventId_key" ON "razorpay_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "razorpay_webhook_events_createdAt_idx" ON "razorpay_webhook_events"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpayPaymentId_key" ON "subscriptions"("razorpayPaymentId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_razorpayPaymentId_fkey" FOREIGN KEY ("razorpayPaymentId") REFERENCES "razorpay_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razorpay_payments" ADD CONSTRAINT "razorpay_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one open (PENDING) Razorpay payment per user, plan and channel, so
-- concurrent clicks reuse one order/link instead of minting several. Partial
-- index: Prisma's schema language cannot express it, so it lives here only.
CREATE UNIQUE INDEX "razorpay_payments_one_pending_key" ON "razorpay_payments"("userId", "plan", "channel") WHERE "status" = 'PENDING';

-- CreateEnum
CREATE TYPE "TelegramEventType" AS ENUM ('START', 'BROWSE', 'SEARCH', 'COURSE_VIEW', 'UPCOMING_VIEW', 'DOWNLOAD_REQUESTED', 'HELP', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "availableAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "download_events" ADD COLUMN     "source" TEXT,
ADD COLUMN     "telegramUserId" TEXT;

-- CreateTable
CREATE TABLE "telegram_users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "botBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastSearch" TEXT,
    "lastSearchAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TelegramEventType" NOT NULL,
    "courseId" TEXT,
    "query" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BroadcastDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_users_telegramId_key" ON "telegram_users"("telegramId");

-- CreateIndex
CREATE INDEX "telegram_users_lastSeenAt_idx" ON "telegram_users"("lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "telegram_users_firstSeenAt_idx" ON "telegram_users"("firstSeenAt" DESC);

-- CreateIndex
CREATE INDEX "telegram_users_blocked_idx" ON "telegram_users"("blocked");

-- CreateIndex
CREATE INDEX "telegram_events_type_createdAt_idx" ON "telegram_events"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "telegram_events_courseId_type_idx" ON "telegram_events"("courseId", "type");

-- CreateIndex
CREATE INDEX "telegram_events_userId_createdAt_idx" ON "telegram_events"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "telegram_events_createdAt_idx" ON "telegram_events"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "broadcasts_status_createdAt_idx" ON "broadcasts"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcastId_status_idx" ON "broadcast_recipients"("broadcastId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcastId_userId_key" ON "broadcast_recipients"("broadcastId", "userId");

-- CreateIndex
CREATE INDEX "courses_published_availableAt_idx" ON "courses"("published", "availableAt");

-- CreateIndex
CREATE INDEX "download_events_source_createdAt_idx" ON "download_events"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "telegram_events" ADD CONSTRAINT "telegram_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_events" ADD CONSTRAINT "telegram_events_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


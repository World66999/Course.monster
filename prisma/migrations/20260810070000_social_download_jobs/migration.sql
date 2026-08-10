-- CreateEnum
CREATE TYPE "SocialJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "social_download_jobs" (
    "id" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "status" "SocialJobStatus" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "social_download_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_download_jobs_remoteId_key" ON "social_download_jobs"("remoteId");

-- CreateIndex
CREATE INDEX "social_download_jobs_userId_createdAt_idx" ON "social_download_jobs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "social_download_jobs_status_createdAt_idx" ON "social_download_jobs"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "social_download_jobs_platform_createdAt_idx" ON "social_download_jobs"("platform", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "social_download_jobs_createdAt_idx" ON "social_download_jobs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "social_download_jobs" ADD CONSTRAINT "social_download_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


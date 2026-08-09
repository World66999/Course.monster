-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('REQUEST', 'RECOMMENDATION');

-- AlterTable
ALTER TABLE "course_requests" ADD COLUMN     "kind" "RequestKind" NOT NULL DEFAULT 'REQUEST';

-- CreateTable
CREATE TABLE "request_follows" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_follows_userId_idx" ON "request_follows"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "request_follows_requestId_userId_key" ON "request_follows"("requestId", "userId");

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_kind_createdAt_idx" ON "course_requests"("moderationStatus", "kind", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "request_follows" ADD CONSTRAINT "request_follows_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_follows" ADD CONSTRAINT "request_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


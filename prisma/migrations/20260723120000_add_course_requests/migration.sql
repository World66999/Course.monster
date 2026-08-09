-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'AVAILABLE', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_COMMENT', 'REQUEST_REPLY', 'REQUEST_MENTION', 'REQUEST_STATUS_CHANGE', 'ADMIN_RESPONSE');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "courseRequestId" TEXT,
ADD COLUMN     "requestCommentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "requestBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "course_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "skillLevel" "SkillLevel",
    "instructor" TEXT,
    "sourceProvider" TEXT,
    "referenceUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "imageThumbUrl" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "commentsLocked" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "mergedIntoId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_votes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_bookmarks" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_comments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "request_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "requestId" TEXT,
    "commentId" TEXT,
    "actorId" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_status_createdAt_idx" ON "course_requests"("moderationStatus", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_status_voteCount_idx" ON "course_requests"("moderationStatus", "status", "voteCount" DESC);

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_status_lastActivityAt_idx" ON "course_requests"("moderationStatus", "status", "lastActivityAt" DESC);

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_pinned_createdAt_idx" ON "course_requests"("moderationStatus", "pinned", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "course_requests_moderationStatus_createdAt_idx" ON "course_requests"("moderationStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "course_requests_categoryId_idx" ON "course_requests"("categoryId");

-- CreateIndex
CREATE INDEX "course_requests_userId_createdAt_idx" ON "course_requests"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "course_requests_mergedIntoId_idx" ON "course_requests"("mergedIntoId");

-- CreateIndex
CREATE INDEX "request_votes_userId_idx" ON "request_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "request_votes_requestId_userId_key" ON "request_votes"("requestId", "userId");

-- CreateIndex
CREATE INDEX "request_bookmarks_userId_idx" ON "request_bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "request_bookmarks_requestId_userId_key" ON "request_bookmarks"("requestId", "userId");

-- CreateIndex
CREATE INDEX "request_comments_requestId_parentId_status_createdAt_idx" ON "request_comments"("requestId", "parentId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "request_comments_parentId_idx" ON "request_comments"("parentId");

-- CreateIndex
CREATE INDEX "request_comments_userId_createdAt_idx" ON "request_comments"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "request_comments_status_createdAt_idx" ON "request_comments"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "request_comment_reactions_commentId_idx" ON "request_comment_reactions"("commentId");

-- CreateIndex
CREATE INDEX "request_comment_reactions_userId_idx" ON "request_comment_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "request_comment_reactions_commentId_userId_emoji_key" ON "request_comment_reactions"("commentId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_requestId_idx" ON "notifications"("requestId");

-- CreateIndex
CREATE INDEX "reports_courseRequestId_idx" ON "reports"("courseRequestId");

-- CreateIndex
CREATE INDEX "reports_requestCommentId_idx" ON "reports"("requestCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_courseRequestId_reporterId_key" ON "reports"("courseRequestId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_requestCommentId_reporterId_key" ON "reports"("requestCommentId", "reporterId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_courseRequestId_fkey" FOREIGN KEY ("courseRequestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requestCommentId_fkey" FOREIGN KEY ("requestCommentId") REFERENCES "request_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "course_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_votes" ADD CONSTRAINT "request_votes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_votes" ADD CONSTRAINT "request_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_bookmarks" ADD CONSTRAINT "request_bookmarks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_bookmarks" ADD CONSTRAINT "request_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "request_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comment_reactions" ADD CONSTRAINT "request_comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "request_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comment_reactions" ADD CONSTRAINT "request_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "course_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "request_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


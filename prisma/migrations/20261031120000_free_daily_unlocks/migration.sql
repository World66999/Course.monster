-- CreateTable
CREATE TABLE "free_unlock_quotas" (
    "subjectKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_unlock_quotas_pkey" PRIMARY KEY ("subjectKey")
);

-- CreateTable
CREATE TABLE "free_unlocks" (
    "id" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_unlock_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "wantedProvider" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "userId" TEXT,
    "minCompleteAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_unlock_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "free_unlock_quotas_day_count_idx" ON "free_unlock_quotas"("day", "count");

-- CreateIndex
CREATE INDEX "free_unlocks_day_idx" ON "free_unlocks"("day");

-- CreateIndex
CREATE UNIQUE INDEX "free_unlocks_subjectKey_courseId_key" ON "free_unlocks"("subjectKey", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "free_unlock_sessions_tokenHash_key" ON "free_unlock_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "free_unlock_sessions_subjectKey_courseId_createdAt_idx" ON "free_unlock_sessions"("subjectKey", "courseId", "createdAt");

-- CreateIndex
CREATE INDEX "free_unlock_sessions_expiresAt_idx" ON "free_unlock_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "free_unlocks" ADD CONSTRAINT "free_unlocks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_unlock_sessions" ADD CONSTRAINT "free_unlock_sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;


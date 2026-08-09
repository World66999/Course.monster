-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "chatMessageId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "chatBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chatDisplayName" TEXT,
ADD COLUMN     "chatMutedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',
    "linkPending" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_status_linkPending_createdAt_idx" ON "chat_messages"("status", "linkPending", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_status_createdAt_idx" ON "chat_messages"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_parentId_idx" ON "chat_messages"("parentId");

-- CreateIndex
CREATE INDEX "chat_messages_userId_createdAt_idx" ON "chat_messages"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_reactions_messageId_idx" ON "chat_reactions"("messageId");

-- CreateIndex
CREATE INDEX "chat_reactions_userId_idx" ON "chat_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_reactions_messageId_userId_emoji_key" ON "chat_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "reports_chatMessageId_idx" ON "reports"("chatMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_chatMessageId_reporterId_key" ON "reports"("chatMessageId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "users_chatDisplayName_key" ON "users"("chatDisplayName");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


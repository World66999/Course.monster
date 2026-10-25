-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "returnPath" TEXT;
-- CreateTable
CREATE TABLE "premium_chat_invites" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteLink" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_chat_invites_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "premium_chat_invites_userId_revokedAt_expiresAt_idx" ON "premium_chat_invites"("userId", "revokedAt", "expiresAt");
-- AddForeignKey
ALTER TABLE "premium_chat_invites" ADD CONSTRAINT "premium_chat_invites_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "premium_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "premium_chat_invites" ADD CONSTRAINT "premium_chat_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

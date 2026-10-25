import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PremiumChatsManager } from "@/components/admin/premium/premium-chats-manager";

export const metadata: Metadata = { title: "Premium Chats" };
export const dynamic = "force-dynamic";

export default async function AdminPremiumChatsPage() {
  const [chats, messages] = await Promise.all([
    db.premiumChat.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        kind: true,
        telegramChatId: true,
        published: true,
        order: true,
        _count: { select: { messages: true } },
      },
    }),
    db.premiumChatMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        body: true,
        createdAt: true,
        chat: { select: { title: true } },
        user: { select: { id: true, email: true, name: true, role: true, premiumChatBanned: true, premiumChatMutedUntil: true } },
      },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Premium Chats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          On-site rooms and private Telegram groups for members. For a Telegram group, add the bot to the group as an
          administrator with “Invite users” permission and paste the group&apos;s chat id.
        </p>
      </div>
      <PremiumChatsManager
        chats={chats.map(({ _count, ...c }) => ({ ...c, messageCount: _count.messages }))}
        messages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          user: {
            ...m.user,
            muted: Boolean(m.user.premiumChatMutedUntil && m.user.premiumChatMutedUntil.getTime() > Date.now()),
          },
        }))}
      />
    </div>
  );
}

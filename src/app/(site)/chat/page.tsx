import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { getSiteSettings } from "@/lib/settings";
import { listChatMessages, toChatMessagesResponse } from "@/lib/chat";
import { Section } from "@/components/site/section";
import { ChatPanel } from "@/components/site/chat/chat-panel";

export const metadata: Metadata = {
  title: "Community Chat",
  description: "Chat with other learners in real time.",
  alternates: { canonical: "/chat" },
};
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [settings, session] = await Promise.all([getSiteSettings(), auth()]);
  const userId = session?.user?.id ?? null;

  const requestedAt = new Date();
  const { items, nextCursor } = await listChatMessages({ limit: 30 });
  const initial = await toChatMessagesResponse(items, nextCursor, userId, requestedAt);

  return (
    <Section className="max-w-2xl py-10 sm:py-14">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-card bg-gradient-to-br from-accent to-primary text-white shadow-sm shadow-primary/30">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Community Chat</h1>
          <p className="text-sm text-muted-foreground">Say hello, ask questions, help each other out.</p>
        </div>
      </div>

      {settings.chat.enabled ? (
        <ChatPanel initial={initial} />
      ) : (
        <p className="rounded-card border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Chat is currently disabled.
        </p>
      )}
    </Section>
  );
}

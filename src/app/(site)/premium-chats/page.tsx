import type { Metadata } from "next";
import { listPremiumChatsPublic } from "@/lib/premium-catalog";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { PremiumChatGrid } from "@/components/premium/chat-grid";

export const metadata: Metadata = {
  title: "Premium Chats — Members-only Rooms",
  description: "Smaller, moderated members-only chat rooms and private Telegram groups for Courses Monster Premium members.",
  alternates: { canonical: "/premium-chats" },
  openGraph: { title: "Premium Chats — Courses Monster", url: absoluteUrl("/premium-chats") },
};

export const revalidate = 300;

export default async function PremiumChatsPage() {
  const chats = await listPremiumChatsPublic();
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Premium"
        title="Premium Chats"
        description="Members-only rooms, moderated by our team. Private Telegram groups use single-use invite links, so a shared link can't be reused."
      />
      <PremiumChatGrid chats={chats} />
    </Section>
  );
}

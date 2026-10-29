import type { Metadata } from "next";
import { listPremiumChatsPublic } from "@/lib/premium-catalog";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { PremiumChatGrid } from "@/components/premium/chat-grid";

export const metadata: Metadata = {
  title: "Members' Telegram Groups — Premium",
  description: "Private Telegram groups for Courses Monster Premium members, joined with single-use invite links.",
  alternates: { canonical: "/premium-chats" },
  openGraph: { title: "Members' Telegram Groups — Courses Monster", url: absoluteUrl("/premium-chats") },
};

export const revalidate = 300;

export default async function PremiumChatsPage() {
  const chats = await listPremiumChatsPublic();
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Premium"
        title="Members' Telegram Groups"
        description="Private Telegram groups for Premium members. Each invite link works once and expires after 15 minutes, so a shared link can't be reused."
      />
      <PremiumChatGrid chats={chats} />
    </Section>
  );
}

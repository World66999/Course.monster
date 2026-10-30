import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/db";
import { Section } from "@/components/site/section";
import { PremiumChatRoom } from "@/components/premium/chat-room";

export const metadata: Metadata = { title: "Premium Chat", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The room's public header only. Messages load through the premium API. */
export default async function PremiumChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) notFound();
  const chat = await db.premiumChat.findFirst({
    where: { id, published: true, kind: "WEB_ROOM" },
    select: { id: true, title: true, description: true },
  });
  if (!chat) notFound();
  return (
    <Section className="max-w-3xl py-10">
      <Link href="/premium-chats" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All Premium Chats
      </Link>
      <h1 className="text-heading">{chat.title}</h1>
      <p className="mt-1 text-muted-foreground">{chat.description}</p>
      <div className="mt-6">
        <PremiumChatRoom chatId={chat.id} />
      </div>
    </Section>
  );
}

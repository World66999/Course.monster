import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CodingChannelForm } from "@/components/admin/coding-channel-form";

export const metadata: Metadata = { title: "Edit coding channel" };
export const dynamic = "force-dynamic";

export default async function EditCodingChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = await db.codingChannel.findUnique({ where: { id } });
  if (!channel) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit coding channel</h1>
      <CodingChannelForm
        channelId={channel.id}
        defaultValues={{
          name: channel.name,
          slug: channel.slug,
          url: channel.url,
          logo: channel.logo ?? "",
          shortDescription: channel.shortDescription ?? "",
          description: channel.description ?? "",
          tags: channel.tags.join(", "),
          spokenLanguage: channel.spokenLanguage ?? "",
          skillLevel: channel.skillLevel ?? "",
          bestSuitedFor: channel.bestSuitedFor ?? "",
          featured: channel.featured,
          verified: channel.verified,
          published: channel.published,
        }}
      />
    </div>
  );
}

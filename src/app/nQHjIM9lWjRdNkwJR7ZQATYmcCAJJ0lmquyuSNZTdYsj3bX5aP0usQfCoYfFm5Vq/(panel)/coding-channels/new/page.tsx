import type { Metadata } from "next";
import { CodingChannelForm } from "@/components/admin/coding-channel-form";

export const metadata: Metadata = { title: "New coding channel" };
export const dynamic = "force-dynamic";

export default function NewCodingChannelPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New coding channel</h1>
      <CodingChannelForm
        channelId={null}
        defaultValues={{
          name: "",
          slug: "",
          url: "",
          logo: "",
          shortDescription: "",
          description: "",
          tags: "",
          spokenLanguage: "",
          skillLevel: "",
          bestSuitedFor: "",
          featured: false,
          verified: true,
          published: false,
        }}
      />
    </div>
  );
}

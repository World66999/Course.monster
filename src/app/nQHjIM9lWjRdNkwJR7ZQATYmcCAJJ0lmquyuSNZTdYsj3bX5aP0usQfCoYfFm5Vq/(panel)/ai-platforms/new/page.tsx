import type { Metadata } from "next";
import { AiPlatformForm } from "@/components/admin/ai-platform-form";

export const metadata: Metadata = { title: "New AI platform" };
export const dynamic = "force-dynamic";

export default function NewAiPlatformPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-heading">New AI platform</h1>
      <AiPlatformForm
        platformId={null}
        defaultValues={{
          name: "",
          description: "",
          url: "",
          category: "CHAT",
          // Least-overstating default: the admin must actively choose a
          // stronger claim rather than inheriting one.
          pricingType: "FREE_TIER",
          freeTierNote: "",
          logo: "",
          tags: "",
          featured: false,
          published: false,
          order: 0,
        }}
      />
    </div>
  );
}

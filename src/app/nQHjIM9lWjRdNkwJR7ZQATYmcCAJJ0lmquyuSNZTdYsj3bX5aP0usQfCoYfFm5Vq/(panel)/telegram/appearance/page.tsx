import type { Metadata } from "next";
import { getBranding } from "@/lib/telegram/branding";
import { AppearanceManager } from "@/components/admin/telegram/appearance-manager";

export const metadata: Metadata = { title: "Telegram appearance" };
export const dynamic = "force-dynamic";

export default async function TelegramAppearancePage() {
  // Plain JSON — the client component owns all editing state from here.
  const branding = await getBranding();
  return <AppearanceManager branding={branding} />;
}

import type { Metadata } from "next";
import { getBranding } from "@/lib/telegram/branding";
import { customEmojiCapability } from "@/lib/telegram/custom-emoji";
import { getLastCustomEmojiError } from "@/lib/telegram/api";
import { AppearanceManager } from "@/components/admin/telegram/appearance-manager";

export const metadata: Metadata = { title: "Telegram appearance" };
export const dynamic = "force-dynamic";

export default async function TelegramAppearancePage() {
  // Plain JSON — the client component owns all editing state from here.
  const [branding, capability] = await Promise.all([getBranding(), customEmojiCapability()]);
  const lastError = getLastCustomEmojiError();
  return (
    <AppearanceManager
      branding={branding}
      capability={capability}
      lastEmojiError={lastError ? lastError.description : null}
    />
  );
}

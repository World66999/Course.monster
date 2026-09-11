import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Website settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything here applies site-wide without touching code.
        </p>
      </div>
      <SettingsForm defaultValues={settings} />
    </div>
  );
}

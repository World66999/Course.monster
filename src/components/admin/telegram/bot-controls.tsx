"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, PlugZap, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/admin-action";
import {
  checkBotAction,
  registerWebhookAction,
  removeWebhookAction,
} from "@/server/actions/admin-telegram";

/** Webhook registration. The URL is built server-side and never accepted from here. */
export function BotControls({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(name: string, fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, success: string) {
    if (busy) return;
    setBusy(name);
    try {
      const result = await safeAction(fn);
      if (result.ok) {
        toast.success(result.id ? `${success} (@${result.id})` : success);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!configured || busy !== null}
        onClick={() => void run("check", checkBotAction, "Bot reachable")}
      >
        {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlugZap className="h-4 w-4" aria-hidden />}
        Test connection
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!configured || busy !== null}
        onClick={() => void run("set", registerWebhookAction, "Webhook registered and commands published")}
      >
        {busy === "set" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        Register webhook
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!configured || busy !== null}
        onClick={() => void run("del", removeWebhookAction, "Webhook removed")}
      >
        {busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Unplug className="h-4 w-4" aria-hidden />}
        Remove webhook
      </Button>
    </div>
  );
}

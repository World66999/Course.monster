"use client";

import * as React from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CrownMark } from "@/components/premium/crown";

/** Premium path: one click, one server check, straight to the file. */
export function InstantDownload({ slug }: { slug: string }) {
  const [busy, setBusy] = React.useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await fetch("/api/download/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? "Something went wrong.");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CrownMark />
      <p className="text-sm text-muted-foreground">Premium — no countdown, no steps, no ads.</p>
      <Button size="lg" variant="accent" className="bg-gold w-full max-w-sm shadow-gold" onClick={go} disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Zap className="h-5 w-5" aria-hidden />}
        Download instantly
      </Button>
    </div>
  );
}

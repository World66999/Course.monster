"use client";

import * as React from "react";
import { Loader2, Zap } from "lucide-react";
import { CrownMark } from "@/components/premium/crown";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Premium path: the server has already checked access and minted a
 * single-use direct token, so this only follows it. A full-page navigation,
 * not a router push, so the token is spent exactly once by the real visit.
 */
export function DirectRedirect({ href }: { href: string }) {
  React.useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <div className="space-y-5 text-center" data-direct-redirect>
      <div className="flex justify-center">
        <CrownMark size="lg" />
      </div>
      <div>
        <p className="text-subheading">Opening your direct link…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Premium — no steps, no ads.
        </p>
      </div>
      <a
        href={href}
        className={cn(buttonClasses("accent", "lg"), "bg-gold shadow-gold")}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <Zap className="h-4 w-4" aria-hidden /> Continue
      </a>
    </div>
  );
}

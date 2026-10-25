"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/site/brand-icons";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeInternalPath } from "@/lib/safe-url";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [loading, setLoading] = React.useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        // Same ?next= contract as the password form (validated, same-site only).
        const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
        void signIn("google", { callbackUrl: next });
      }}
      className={cn(buttonClasses("outline", "lg"), "w-full bg-card")}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <GoogleIcon className="h-4 w-4" aria-hidden />
      )}
      {label}
    </button>
  );
}

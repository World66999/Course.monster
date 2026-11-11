"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Turnstile } from "@marsidev/react-turnstile";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, ExternalLink, Loader2, TimerReset } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

// Code-split: the verification gateway (challenge mini-games, animations)
// only ever renders after the user clicks "Get download link", so it should
// never be part of this page's initial bundle.
const VerificationGateway = dynamic(
  // One retry: a single dropped request should not end in the error screen.
  () =>
    import("@/components/site/verify/verification-gateway")
      .catch(() =>
        new Promise<void>((resolve) => setTimeout(resolve, 1200)).then(
          () => import("@/components/site/verify/verification-gateway"),
        ),
      )
      .then((m) => m.VerificationGateway),
  {
    ssr: false,
    loading: () => (
      <div className="flex w-full items-center justify-center rounded-card border border-border bg-card py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    ),
  }
);

type Phase = "counting" | "verify" | "ready" | "gateway" | "launching" | "redirected";

export function DownloadGate({
  slug,
  countdownSeconds,
  captchaSiteKey,
  attribution = "",
}: {
  slug: string;
  countdownSeconds: number;
  captchaSiteKey: string;
  /** Opaque signed blob from a Telegram hand-off; forwarded verbatim, never parsed here. */
  attribution?: string;
}) {
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const captchaEnabled = captchaSiteKey.length > 0;

  const [secondsLeft, setSecondsLeft] = React.useState(countdownSeconds);
  const [captchaToken, setCaptchaToken] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>(countdownSeconds > 0 ? "counting" : "verify");
  const [error, setError] = React.useState("");

  // Countdown tick.
  React.useEffect(() => {
    if (phase !== "counting") return;
    if (secondsLeft <= 0) {
      setPhase("verify");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  const canDownload =
    (phase === "verify" || phase === "ready") && (!captchaEnabled || captchaToken.length > 0);

  React.useEffect(() => {
    if (phase === "verify" && canDownload) setPhase("ready");
  }, [phase, canDownload]);

  function openGateway() {
    if (!canDownload) return;
    setError("");
    setPhase("gateway");
  }

  async function startDownload(humanTicket: string) {
    setPhase("launching");
    setError("");
    try {
      const res = await fetch("/api/download/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, captchaToken, humanTicket, attribution }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string; code?: string };
      if (data.code === "limit") {
        // Today's free unlocks ran out since the page loaded: the page itself
        // shows the limit screen and the Premium offer.
        toast.error(data.error ?? "Daily free limit reached.");
        window.location.reload();
        return;
      }
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setPhase("redirected");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
      // The human-verification ticket is single-use regardless of outcome
      // here, so a retry always goes through the gateway again for a fresh
      // one rather than silently reusing a (now-consumed) ticket.
      setPhase(captchaEnabled ? "verify" : "ready");
      setCaptchaToken("");
    }
  }

  const progress =
    countdownSeconds > 0 ? ((countdownSeconds - secondsLeft) / countdownSeconds) * 100 : 100;

  return (
    <div className="flex flex-col items-center gap-6">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "counting" ? (
          <motion.div
            key="countdown"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="flex flex-col items-center gap-4"
            aria-live="polite"
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96" aria-hidden>
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  strokeWidth="6"
                  className="stroke-muted"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - progress / 100)}
                  className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <span className="text-3xl font-bold tabular-nums">{secondsLeft}</span>
            </div>
            <p className="text-sm text-muted-foreground">Preparing your download…</p>
          </motion.div>
        ) : phase === "gateway" ? (
          <motion.div
            key="gateway"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="w-full"
          >
            <VerificationGateway slug={slug} onVerified={(ticket) => void startDownload(ticket)} />
          </motion.div>
        ) : (
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="flex w-full flex-col items-center gap-5"
          >
            {captchaEnabled && (
              <Turnstile
                siteKey={captchaSiteKey}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
                onError={() => {
                  setCaptchaToken("");
                  setError("Captcha failed to load. Refresh the page and try again.");
                }}
                options={{ theme: resolvedTheme === "dark" ? "dark" : "light" }}
              />
            )}

            {error && (
              <p role="alert" className="text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="w-full max-w-sm"
              disabled={!canDownload}
              onClick={openGateway}
            >
              {phase === "launching" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Generating secure link…
                </>
              ) : phase === "redirected" ? (
                <>
                  <ExternalLink className="h-5 w-5" aria-hidden />
                  Redirecting…
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" aria-hidden />
                  {captchaEnabled && !captchaToken ? "Complete the captcha above" : "Get download link"}
                </>
              )}
            </Button>

            {phase === "redirected" && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <TimerReset className="h-4 w-4" aria-hidden />
                Didn&apos;t redirect? Try again
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

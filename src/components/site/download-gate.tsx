"use client";

import * as React from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, Loader2, TimerReset } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Phase = "counting" | "verify" | "ready" | "launching" | "redirected";

export function DownloadGate({
  slug,
  countdownSeconds,
  captchaSiteKey,
}: {
  slug: string;
  countdownSeconds: number;
  captchaSiteKey: string;
}) {
  const { resolvedTheme } = useTheme();
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

  async function startDownload() {
    if (!canDownload) return;
    setPhase("launching");
    setError("");
    try {
      const res = await fetch("/api/download/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, captchaToken }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setPhase("redirected");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
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
        ) : (
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
              onClick={() => void startDownload()}
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

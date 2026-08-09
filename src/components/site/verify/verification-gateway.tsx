"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Loader2, RotateCcw } from "lucide-react";
import { ProgressStages } from "@/components/site/verify/progress-stages";
import { ChallengeSlider } from "@/components/site/verify/challenge-slider";
import { ChallengeDial } from "@/components/site/verify/challenge-dial";
import { ChallengeSequence } from "@/components/site/verify/challenge-sequence";
import { Button } from "@/components/ui/button";
import type {
  ChallengeType,
  ChallengeParams,
  SliderParams,
  DialParams,
  SequenceParams,
  ChallengeCompletion,
} from "@/components/site/verify/types";

type Stage = "boot" | "validating" | "preparing" | "ready" | "challenge" | "verifying" | "success" | "failure";

const STAGE_INDEX: Record<Stage, number> = {
  boot: 0,
  validating: 1,
  preparing: 2,
  ready: 3,
  challenge: 3,
  verifying: 3,
  success: 3,
  failure: 3,
};

const MIN_STAGE_MS = 340;

async function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const [result] = await Promise.all([promise, new Promise((r) => setTimeout(r, ms))]);
  return result;
}

export function VerificationGateway({
  slug,
  onVerified,
}: {
  slug: string;
  onVerified: (humanTicket: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = React.useState<Stage>("boot");
  const [challenge, setChallenge] = React.useState<{ type: ChallengeType; params: ChallengeParams; ticket: string } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = React.useState("");
  const mountedRef = React.useRef(true);
  const attemptRef = React.useRef(0);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchChallenge = React.useCallback(async () => {
    const myAttempt = ++attemptRef.current;
    setStage("validating");
    try {
      const res = await withMinDuration(
        fetch(`/api/verify/challenge?slug=${encodeURIComponent(slug)}`, {
          signal: AbortSignal.timeout(8000),
        }),
        MIN_STAGE_MS
      );
      if (!mountedRef.current || myAttempt !== attemptRef.current) return;
      if (!res.ok) throw new Error("issue-failed");
      const data = (await res.json()) as { type: ChallengeType; params: ChallengeParams; ticket: string };

      setStage("preparing");
      await new Promise((r) => setTimeout(r, MIN_STAGE_MS));
      if (!mountedRef.current || myAttempt !== attemptRef.current) return;

      setChallenge(data);
      setStage("ready");
      await new Promise((r) => setTimeout(r, MIN_STAGE_MS - 60));
      if (!mountedRef.current || myAttempt !== attemptRef.current) return;
      setStage("challenge");
    } catch {
      if (!mountedRef.current || myAttempt !== attemptRef.current) return;
      setErrorMessage("Couldn't reach the verification service. Check your connection and try again.");
      setStage("failure");
    }
  }, [slug]);

  React.useEffect(() => {
    const t = setTimeout(() => void fetchChallenge(), 300);
    return () => clearTimeout(t);
  }, [fetchChallenge]);

  async function onChallengeComplete(completion: ChallengeCompletion) {
    if (!challenge) return;
    setStage("verifying");
    try {
      const res = await withMinDuration(
        fetch("/api/verify/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            ticket: challenge.ticket,
            solution: completion.solution,
            trace: completion.trace,
          }),
          signal: AbortSignal.timeout(8000),
        }),
        420
      );
      const data = (await res.json()) as { ok: boolean; humanTicket?: string; error?: string };
      if (!mountedRef.current) return;
      if (!res.ok || !data.ok || !data.humanTicket) {
        setErrorMessage(data.error || "That didn't quite match. Let's try a fresh check.");
        setStage("failure");
        return;
      }
      setStage("success");
      const ticket = data.humanTicket;
      setTimeout(() => {
        if (mountedRef.current) onVerified(ticket);
      }, 700);
    } catch {
      if (!mountedRef.current) return;
      setErrorMessage("Couldn't reach the verification service. Check your connection and try again.");
      setStage("failure");
    }
  }

  function retry() {
    setChallenge(null);
    setErrorMessage("");
    void fetchChallenge();
  }

  const showStages = stage === "boot" || stage === "validating" || stage === "preparing" || stage === "ready";

  return (
    <div
      className="glass flex w-full flex-col items-center gap-6 rounded-2xl p-6 shadow-elevated inset-shadow-highlight sm:p-8"
      role="region"
      aria-label="Human verification"
    >
      <AnimatePresence mode="wait">
        {showStages && (
          <motion.div
            key="stages"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex w-full flex-col items-center gap-5"
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <ProgressStages activeIndex={STAGE_INDEX[stage]} />
          </motion.div>
        )}

        {stage === "challenge" && challenge && (
          <motion.div
            key="challenge"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="flex w-full flex-col items-center gap-5"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Quick verification</p>
            {challenge.type === "slider" && (
              <ChallengeSlider params={challenge.params as SliderParams} onComplete={onChallengeComplete} />
            )}
            {challenge.type === "dial" && (
              <ChallengeDial params={challenge.params as DialParams} onComplete={onChallengeComplete} />
            )}
            {challenge.type === "sequence" && (
              <ChallengeSequence params={challenge.params as SequenceParams} onComplete={onChallengeComplete} />
            )}
          </motion.div>
        )}

        {stage === "verifying" && (
          <motion.div
            key="verifying"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6"
            aria-live="polite"
          >
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Verifying…</p>
          </motion.div>
        )}

        {stage === "success" && (
          <motion.div
            key="success"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex flex-col items-center gap-3 py-6"
            aria-live="polite"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15"
              initial={reduceMotion ? false : { scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.05 }}
            >
              <ShieldCheck className="h-8 w-8 text-success" aria-hidden />
            </motion.div>
            <p className="font-medium text-foreground">Verified</p>
          </motion.div>
        )}

        {stage === "failure" && (
          <motion.div
            key="failure"
            initial={reduceMotion ? false : { opacity: 0, x: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
            aria-live="assertive"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/12">
              <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button type="button" variant="outline" onClick={retry}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, Gift, Lock, Route } from "lucide-react";
import { CrownMark } from "@/components/premium/crown";
import { PROVIDER_LABEL, providerForSlot, type ShortenerProvider } from "@/lib/shortener-core";
import { cn } from "@/lib/utils";

/** Why /unlock sent the visitor back here (see src/app/unlock/[token]/route.ts). */
const NOTICES: Record<string, { title: string; text: string }> = {
  early: {
    title: "That was too quick",
    text: "The shortener steps weren't completed. Please open the link again and finish every step.",
  },
  browser: {
    title: "Different browser",
    text: "Please finish the shortener in the same browser you started it in. Start again below.",
  },
  expired: {
    title: "Link expired",
    text: "That unlock link expired. Start again below — it won't use an extra free course.",
  },
  used: { title: "Already used", text: "That unlock link was already used." },
  invalid: { title: "Link not valid", text: "That unlock link isn't valid. Start again below." },
  ipcap: {
    title: "Network limit reached",
    text: "Too many free unlocks from your network today. Try again after midnight (IST), or get Premium.",
  },
};

export function UnlockNotice({ reason }: { reason: string }) {
  const notice = NOTICES[reason];
  if (!notice) return null;
  return (
    <div
      role="status"
      className="mb-6 flex animate-rise items-start gap-3 rounded-card border border-warning/35 bg-warning-soft p-4 text-sm"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-nested bg-warning/15 text-warning">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
      </span>
      <p className="min-w-0 pt-0.5 leading-relaxed">
        <span className="font-semibold text-foreground">{notice.title}. </span>
        <span className="text-foreground/80">{notice.text}</span>
      </p>
    </div>
  );
}

function formatReset(resetsAt: Date): string {
  return resetsAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

/** "Free courses today: X/Y used", with one step per free unlock and the shortener it uses. */
export function FreeUnlockProgress({
  used,
  limit,
  unlocked,
  nextProvider,
}: {
  used: number;
  limit: number;
  unlocked: boolean;
  nextProvider: ShortenerProvider;
}) {
  const left = Math.max(0, limit - used);
  const steps = Math.min(limit, 6);
  return (
    <section
      aria-label="Free courses today"
      data-free-progress
      className="relative mb-6 animate-rise overflow-hidden rounded-card border border-primary/15 bg-card p-4 shadow-soft sm:p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 bg-[radial-gradient(closest-side,var(--wash-1),transparent)]"
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-nested bg-primary-soft text-primary ring-1 ring-primary/15 ring-inset">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="leading-tight font-semibold">
            Free courses today: {used}/{limit} used
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {left === 1 ? "1 free unlock left" : `${left} free unlocks left`} · resets at midnight IST
          </p>
        </div>
      </div>

      <ol
        className="relative mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }}
        aria-label="Today's free unlocks"
      >
        {Array.from({ length: steps }, (_, i) => {
          const state = i < used ? "done" : i === used && !unlocked ? "next" : "todo";
          const label = PROVIDER_LABEL[providerForSlot(i + 1)];
          return (
            <li key={i} className="min-w-0">
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-colors",
                  state === "done" && "bg-brand",
                  state === "next" && "bg-primary/40 motion-safe:animate-pulse",
                  state === "todo" && "bg-border"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 flex items-center gap-1 truncate text-[11px] font-medium sm:text-xs",
                  state === "done" && "text-foreground",
                  state === "next" && "text-primary",
                  state === "todo" && "text-muted-foreground"
                )}
              >
                {state === "done" && <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={3} aria-hidden />}
                <span className="truncate">{label}</span>
                <span className="sr-only">
                  {state === "done" ? " (used)" : state === "next" ? " (next)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="relative mt-4 border-t border-border/70 pt-3 text-sm">
        {unlocked ? (
          <p className="flex items-start gap-2 font-medium text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            You already unlocked this course — opening it again is free.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              This unlock uses <b className="font-semibold text-foreground">{PROVIDER_LABEL[nextProvider]}</b>. Complete
              all its steps and you&apos;ll come straight back to your course.
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

export function FreeLimitReached({
  limit,
  resetsAt,
  slug,
  network = false,
}: {
  limit: number;
  resetsAt: Date;
  slug: string;
  /** Blocked by the per-IP anti-abuse cap rather than this visitor's own limit. */
  network?: boolean;
}) {
  const next = `/download/${slug}`;
  return (
    <div className="animate-rise space-y-6 text-center" data-free-limit>
      <div className="relative mx-auto w-fit">
        <div aria-hidden className="absolute -inset-6 bg-[radial-gradient(closest-side,var(--wash-1),transparent)]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-primary inset-shadow-highlight">
          <Lock className="h-7 w-7" aria-hidden />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">Daily free limit reached</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {network ? (
            <>
              Too many free unlocks have come from your network today. The limit resets at midnight India time
              (IST).
            </>
          ) : (
            <>
              You&apos;ve used today&apos;s {limit} free courses ({limit}/{limit}). The limit resets at midnight
              India time (IST).
            </>
          )}
        </p>
      </div>

      {!network && (
        <div className="mx-auto flex max-w-56 gap-1.5" aria-hidden>
          {Array.from({ length: Math.min(limit, 6) }, (_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full bg-brand" />
          ))}
        </div>
      )}

      <p className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Next free unlock: {formatReset(resetsAt)} IST
      </p>

      <Link
        href={`/premium?next=${encodeURIComponent(next)}#plans`}
        className="group edge-gold mx-auto flex w-full max-w-sm items-center gap-3 rounded-card border border-gold/40 bg-gold-soft px-4 py-3.5 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
      >
        <CrownMark size="md" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gold-ink">Buy Premium</span>
          <span className="block text-xs text-muted-foreground">Unlimited courses · no ads · no waiting</span>
        </span>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-gold-ink transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>

      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Browse courses for tomorrow
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

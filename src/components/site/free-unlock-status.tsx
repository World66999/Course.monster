import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Lock } from "lucide-react";
import { CrownMark } from "@/components/premium/crown";
import { PROVIDER_LABEL, type ShortenerProvider } from "@/lib/shortener-core";

/** Why /unlock sent the visitor back here (see src/app/unlock/[token]/route.ts). */
const NOTICES: Record<string, string> = {
  early: "That was too quick — the shortener steps weren't completed. Please open the link again and finish every step.",
  browser: "Please finish the shortener in the same browser you started it in. Start again below.",
  expired: "That unlock link expired. Start again below — it won't use an extra free course.",
  used: "That unlock link was already used.",
  invalid: "That unlock link isn't valid. Start again below.",
};

export function UnlockNotice({ reason }: { reason: string }) {
  const text = NOTICES[reason];
  if (!text) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-nested border border-warning/40 bg-warning/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" aria-hidden />
      <p>{text}</p>
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
  return (
    <div className="mb-6 space-y-2 rounded-nested bg-muted/60 p-4 text-sm" data-free-progress>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">
          Free courses today: {used}/{limit} used
        </span>
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: Math.min(limit, 10) }, (_, i) => (
            <span key={i} className={`h-2 w-5 rounded-full ${i < used ? "bg-primary" : "bg-border"}`} />
          ))}
        </span>
      </div>
      {unlocked ? (
        <p className="flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          You already unlocked this course — opening it again is free.
        </p>
      ) : (
        <p className="text-muted-foreground">
          This unlock uses <b className="text-foreground">{PROVIDER_LABEL[nextProvider]}</b>. Complete all its steps
          and you&apos;ll come straight back to your course.
        </p>
      )}
    </div>
  );
}

export function FreeLimitReached({ limit, resetsAt, slug }: { limit: number; resetsAt: Date; slug: string }) {
  const next = `/download/${slug}`;
  return (
    <div className="space-y-5 text-center" data-free-limit>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-bold">Daily free limit reached</p>
        <p className="text-sm text-muted-foreground">
          You&apos;ve used today&apos;s {limit} free courses ({limit}/{limit}). The limit resets at midnight India time
          (IST).
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Next free unlock: {formatReset(resetsAt)} IST
        </p>
      </div>
      <Link
        href={`/premium?next=${encodeURIComponent(next)}#plans`}
        className="edge-gold mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-card border border-gold/40 bg-gold-soft px-4 py-3 font-bold text-gold-ink transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-gold"
      >
        <CrownMark size="sm" />
        Buy Premium — unlimited, no ads
      </Link>
    </div>
  );
}

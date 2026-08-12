"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Social media downloader.
 *
 * The client only ever talks to this site's own API — the downloader service is
 * not reachable from a browser. Platform selection here is a convenience; the
 * server detects and validates the platform itself and will refuse a mismatch.
 */

const PLATFORMS = [
  { id: "youtube", label: "YouTube", hint: "youtube.com · youtu.be" },
  { id: "facebook", label: "Facebook", hint: "facebook.com · fb.watch" },
  { id: "instagram", label: "Instagram", hint: "instagram.com" },
  { id: "tiktok", label: "TikTok", hint: "tiktok.com" },
  { id: "pinterest", label: "Pinterest", hint: "pinterest.com · pin.it" },
] as const;

type Phase = "idle" | "starting" | "working" | "ready" | "error";

interface JobState {
  id: string;
  status: string;
  percent: number | null;
  phase?: string;
  title?: string | null;
  fileName?: string | null;
  fileSize?: number;
  error?: string | null;
}

function humanSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export function SocialDownloader({ signedIn }: { signedIn: boolean }) {
  const [platform, setPlatform] = React.useState<string>("youtube");
  const [url, setUrl] = React.useState("");
  const [audioOnly, setAudioOnly] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [job, setJob] = React.useState<JobState | null>(null);
  const [error, setError] = React.useState("");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const linkRef = React.useRef<HTMLAnchorElement | null>(null);
  // Each finished job may auto-start its download exactly once, and repeated
  // taps are ignored for a moment afterwards. Without this a double-tap — or the
  // auto-start landing on top of the user's own tap — pulls the whole file twice,
  // which on a phone means paying for the same 27 MB video two or three times.
  const autoStartedRef = React.useRef<string | null>(null);
  const lastClickRef = React.useRef(0);
  const [cancelling, setCancelling] = React.useState(false);

  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  /**
   * Stop a job that is still queued or running.
   *
   * The engine has always supported this; until now nothing in the browser
   * could reach it, so a user who pasted the wrong link had to wait out the
   * whole download while it held one of the two website workers.
   *
   * Polling is stopped first: the DELETE settles the row as CANCELLED, and a
   * poll landing in between would otherwise repaint the job as still working.
   */
  async function cancel() {
    if (!job?.id || cancelling) return;
    setCancelling(true);
    stopPolling();
    try {
      const res = await fetch(`/api/social/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setPhase("idle");
      setJob(null);
    } catch {
      // Couldn't stop it — say so plainly and resume polling rather than
      // leaving the UI stuck on a state that no longer updates.
      setError("Couldn't cancel that download. It may already have finished.");
      setPhase("error");
    } finally {
      setCancelling(false);
    }
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "starting" || phase === "working") return;
    setError("");
    setJob(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/social/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), platform, audioOnly }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }
      setPhase("working");
      setJob({ id: body.id, status: body.status, percent: null });
      poll(body.id);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setPhase("error");
    }
  }

  function poll(id: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/social/jobs/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: JobState = await res.json();
        setJob(data);
        if (data.status === "COMPLETED") {
          stopPolling();
          setPhase("ready");
          // Fire the convenience auto-start once per job. Mobile browsers may
          // refuse a programmatic click with no user gesture behind it, which is
          // exactly why the visible button below is never conditional on this.
          if (autoStartedRef.current !== data.id) {
            autoStartedRef.current = data.id;
            // The timestamp is deliberately NOT stamped here: this click travels
            // through the same onClick guard below, and pre-stamping it made the
            // guard cancel the very first download it was meant to protect.
            setTimeout(() => linkRef.current?.click(), 150);
          }
        } else if (data.status === "FAILED" || data.status === "EXPIRED" || data.status === "CANCELLED") {
          stopPolling();
          setError(data.error ?? "That download couldn't be completed.");
          setPhase("error");
        }
      } catch {
        /* transient: keep polling */
      }
    }, 2000);
  }

  const busy = phase === "starting" || phase === "working";
  const statusLabel =
    phase === "starting" ? "Preparing…"
    : job?.phase === "downloading" ? "Fetching media…"
    : job?.phase === "processing" ? "Processing…"
    : phase === "working" ? "Queued…"
    : "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Platform</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              aria-pressed={platform === p.id}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                platform === p.id
                  ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                  : "border-border hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <FieldHint>
          {PLATFORMS.find((p) => p.id === platform)?.hint} — the link is checked on the server, so
          picking the wrong tab just shows a hint.
        </FieldHint>
      </div>

      <form onSubmit={start} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="social-url">Video URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="social-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className="flex-1"
              disabled={busy}
            />
            <Button type="submit" disabled={busy || !url.trim() || !signedIn} className="sm:w-auto">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              {busy ? "Working…" : "Download"}
            </Button>
          </div>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={audioOnly}
            onChange={(e) => setAudioOnly(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 rounded border-border"
          />
          Audio only (smaller file)
        </label>

        {!signedIn && (
          <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Please <Link href="/login" className="font-medium text-primary hover:underline">sign in</Link> to
            use the downloader.
          </p>
        )}
      </form>

      {busy && (
        // aria-live so a screen reader hears "Fetching media…" / "Processing…"
        // as the job moves on; the text changes without any focus change, which
        // is otherwise silent.
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {statusLabel}
          </div>
          {/* Only shown when the downloader genuinely reports progress. */}
          {typeof job?.percent === "number" && (
            <>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={job.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Download progress"
              >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${job.percent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{job.percent}%</p>
            </>
          )}
          {/* Only offered once the job exists — there is nothing to cancel
              during the brief "starting" phase before the id comes back. */}
          {job?.id && (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="cursor-pointer text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelling ? "Cancelling…" : "Cancel download"}
            </button>
          )}
        </div>
      )}

      {phase === "ready" && job && (
        <div className="space-y-3 rounded-2xl border border-success/40 bg-success/10 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">Your download is ready</p>
              {job.title && <p className="truncate text-sm text-muted-foreground">{job.title}</p>}
              {job.fileSize ? <p className="text-xs text-muted-foreground">{humanSize(job.fileSize)}</p> : null}
            </div>
          </div>
          <a
            ref={linkRef}
            href={`/api/social/jobs/${job.id}/file`}
            // Same-origin, so the browser saves rather than navigating; the
            // server's Content-Disposition still decides the final name.
            download={job.fileName ?? ""}
            onClick={(e) => {
              const now = Date.now();
              if (now - lastClickRef.current < 1500) {
                e.preventDefault();
                return;
              }
              lastClickRef.current = now;
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download {job.fileName ? "file" : "now"}
          </a>
          <p className="text-xs text-muted-foreground">
            If your browser blocked the automatic download, use the button above. Links expire after
            a short time.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium">Couldn&apos;t download that</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Only publicly accessible media can be downloaded — private, login-only and age-restricted
          content is refused. Please make sure you have the right to download anything you request,
          and respect each platform&apos;s terms.
        </p>
      </div>
    </div>
  );
}

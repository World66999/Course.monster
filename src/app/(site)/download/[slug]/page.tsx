import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Film, HardDrive, ShieldCheck } from "lucide-react";
import { getPublishedCourse } from "@/lib/courses";
import { getSiteSettings } from "@/lib/settings";
import { Section } from "@/components/site/section";
import { CourseImage } from "@/components/site/course-image";
import { Badge } from "@/components/ui/badge";
import { DownloadGate } from "@/components/site/download-gate";
import { DirectRedirect } from "@/components/premium/direct-redirect";
import { LockedPreview } from "@/components/premium/locked-preview";
import { SkipAdsButton } from "@/components/premium/skip-ads-button";
import { getViewer } from "@/server/premium-guard";
import { canDownloadDirect } from "@/lib/premium";
import { createDownloadToken } from "@/lib/download-token";
import { getClientIp, hashIp } from "@/lib/ip";
import { getFreeStatus, resolveWebSubject } from "@/lib/free-unlocks";
import { FreeLimitReached, FreeUnlockProgress, UnlockNotice } from "@/components/site/free-unlock-status";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string | string[]; unlock?: string | string[] }>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  return {
    title: course ? `Download ${course.title}` : "Download",
    robots: { index: false, follow: false },
  };
}

// Per-viewer: the page mints a user-bound token for members.
export const dynamic = "force-dynamic";

export default async function DownloadPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Opaque attribution blob from a Telegram hand-off. Passed through untouched
  // and verified server-side in /api/download/init; it grants nothing.
  const { src, unlock } = await searchParams;
  const attribution = typeof src === "string" ? src.slice(0, 512) : "";
  const unlockReason = typeof unlock === "string" ? unlock.slice(0, 20) : "";
  const [course, settings] = await Promise.all([getPublishedCourse(slug), getSiteSettings()]);
  if (!course) notFound();

  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  // Premium members never see the steps: access is read from the database
  // right now and, if it holds, a single-use direct token bound to this user
  // is minted here. /go checks that user's access again when it is followed.
  const viewer = await getViewer();
  const ipHash = hashIp(await getClientIp());
  const direct = viewer ? await canDownloadDirect(viewer.id, course) : false;
  const directHref =
    direct && viewer
      ? `/go/${createDownloadToken(course.id, ipHash, undefined, { direct: true, userId: viewer.id })}`
      : null;
  const locked = course.premium && !direct;

  // Free path: today's unlocks for whoever this visit counts against (the bot
  // user it was handed to, else the signed-in account, else the IP).
  const free =
    !directHref && !locked
      ? await getFreeStatus(
          await resolveWebSubject({ attribution, courseId: course.id, viewerId: viewer?.id ?? null, ipHash }),
          course.id
        )
      : null;

  return (
    <Section className="max-w-2xl py-12 sm:py-16">
      <Link
        href={`/courses/${course.slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to course
      </Link>

      <div className="glass overflow-hidden rounded-feature shadow-elevated inset-shadow-highlight">
        {/* Course summary */}
        <div className="flex gap-4 border-b border-border p-5 sm:gap-5 sm:p-6">
          <div className="h-20 w-32 shrink-0 overflow-hidden rounded-nested bg-muted sm:h-24 sm:w-40">
            <CourseImage src={course.thumbnail} title={course.title} priority />
          </div>
          <div className="min-w-0">
            {course.category && (
              <Badge className="mb-1.5">{course.category.name}</Badge>
            )}
            <h1 className="line-clamp-2 leading-snug font-bold sm:text-lg">{course.title}</h1>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
              {course.lecturesCount != null && course.lecturesCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" aria-hidden />
                  {course.lecturesCount} lectures
                </span>
              )}
              {course.sizeLabel && (
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" aria-hidden />
                  {course.sizeLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {directHref ? (
            <DirectRedirect href={directHref} />
          ) : locked ? (
            <div className="space-y-4 text-center">
              <p className="font-semibold">This is a Premium course.</p>
              <LockedPreview
                lines={3}
                href={viewer ? "/premium" : `/login?next=${encodeURIComponent(`/download/${course.slug}`)}`}
                cta={viewer ? "Unlock with Premium" : "Sign in to continue"}
              />
            </div>
          ) : free && free.limitReached && !free.unlocked ? (
            <FreeLimitReached limit={free.limit} resetsAt={free.resetsAt} slug={course.slug} />
          ) : (
            <>
              {unlockReason && <UnlockNotice reason={unlockReason} />}
              {free && (
                <FreeUnlockProgress
                  used={free.used}
                  limit={free.limit}
                  unlocked={free.unlocked}
                  nextProvider={free.nextProvider}
                />
              )}
              <SkipAdsButton slug={course.slug} className="mb-6" />
              <DownloadGate
                slug={course.slug}
                countdownSeconds={settings.downloadCountdownSeconds}
                captchaSiteKey={captchaSiteKey}
                attribution={attribution}
              />
              <SkipAdsButton slug={course.slug} className="mt-6" />
            </>
          )}

          {!directHref && (
            <div className="mt-8 flex items-start gap-3 rounded-nested bg-muted/60 p-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" aria-hidden />
              <p>
                This quick verification keeps the site free for everyone by stopping bots and
                abuse. Having trouble? Read the{" "}
                <Link href="/how-to-download" className="text-primary underline underline-offset-2">
                  download guide
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

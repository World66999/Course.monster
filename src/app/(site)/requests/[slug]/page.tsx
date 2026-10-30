import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";
import { getSiteSettings } from "@/lib/settings";
import {
  getCourseRequestBySlug,
  attachMyRequestState,
  toRequestDetail,
  listRequestComments,
  attachRequestCommentReactions,
  toRequestCommentDTO,
} from "@/lib/course-requests";
import { REQUEST_STATUS_LABELS } from "@/lib/request-shared";
import { absoluteUrl, safeJsonLd } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { CourseImage } from "@/components/site/course-image";
import { RequestStatusBadge, PopularBadge, RequestKindBadge } from "@/components/site/requests/status-badge";
import { RequestDetailActions } from "@/components/site/requests/request-detail-actions";
import { RequestCommentsSection } from "@/components/site/requests/request-comments-section";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

async function loadRequest(slug: string) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const row = await getCourseRequestBySlug(slug);
  if (!row) return null;
  // Hidden content is only visible to its own author or staff — never a public 404 leak either way.
  const canSeeHidden = userId !== null && (userId === row.userId || isStaff(session?.user?.role));
  if (row.moderationStatus === "HIDDEN" && !canSeeHidden) return null;
  return { row, userId, isAdmin: isStaff(session?.user?.role) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadRequest(slug);
  if (!loaded) return { title: "Request not found" };
  const { row } = loaded;

  const title = row.anonymous ? row.title : `${row.title} — Course Request`;
  const description = row.description.length > 200 ? `${row.description.slice(0, 197)}…` : row.description;

  return {
    title,
    description,
    alternates: { canonical: `/requests/${row.slug}` },
    robots: row.moderationStatus === "VISIBLE" ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/requests/${row.slug}`),
      ...(row.imageUrl ? { images: [{ url: absoluteUrl(row.imageUrl) }] } : {}),
    },
  };
}

export default async function RequestDetailPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await loadRequest(slug);
  if (!loaded) notFound();
  const { row, userId, isAdmin } = loaded;

  // Fire-and-forget view counter, same convention as Course.views.
  db.courseRequest.update({ where: { id: row.id }, data: { views: { increment: 1 } } }).catch(() => undefined);

  const [settings, myState, { items: comments }, statusEvents] = await Promise.all([
    getSiteSettings(),
    attachMyRequestState([row], userId),
    listRequestComments(row.id),
    db.auditLog.findMany({
      where: { entity: "courseRequest", entityId: row.id, action: "courseRequest.status_change" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const commentsWithReactions = await attachRequestCommentReactions(comments, userId);
  const commentDTOs = commentsWithReactions.map((c) => toRequestCommentDTO(c, userId));

  const detail = toRequestDetail(row, {
    votedByMe: myState.get(row.id)!.voted,
    bookmarkedByMe: myState.get(row.id)!.bookmarked,
    followedByMe: myState.get(row.id)!.followed,
    currentUserId: userId,
    popularThreshold: settings.courseRequests.popularVoteThreshold,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: detail.title,
    text: detail.description,
    url: absoluteUrl(`/requests/${detail.slug}`),
    datePublished: detail.createdAt,
    dateModified: detail.updatedAt,
    ...(detail.author.isAnonymous
      ? {}
      : { author: { "@type": "Person", name: detail.author.label } }),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: detail.voteCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: detail.commentCount },
    ],
  };

  return (
    <Section className="max-w-4xl py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <Link href="/requests" className="mb-6 inline-flex text-sm text-muted-foreground hover:text-primary">
        ← Back to Course Requests
      </Link>

      {detail.mergedIntoId && (
        <div className="mb-6 rounded-nested border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          This request was merged into another request.{" "}
          <Link href={`/requests/${detail.mergedIntoId}`} className="font-medium underline">
            View it here
          </Link>
          .
        </div>
      )}

      <div className="overflow-hidden rounded-feature border border-border bg-card shadow-elevated">
        {detail.imageUrl && (
          <div className="relative aspect-[21/9] bg-muted">
            <CourseImage src={detail.imageUrl} title={detail.title} priority />
          </div>
        )}

        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <RequestKindBadge kind={detail.kind} />
            <RequestStatusBadge status={detail.status} />
            {detail.isPopular && <PopularBadge />}
            {detail.featured && <Badge variant="default">Featured</Badge>}
            {detail.category && <Badge variant="secondary">{detail.category.name}</Badge>}
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{detail.title}</h1>
          <p className="text-sm font-medium text-muted-foreground">{detail.subject}</p>

          <p className="text-sm text-muted-foreground">
            {detail.kind === "RECOMMENDATION" ? "Recommended" : "Requested"} by {detail.author.label} ·{" "}
            <span suppressHydrationWarning>
              {formatDistanceToNow(new Date(detail.createdAt), { addSuffix: true })}
            </span>{" "}
            · {detail.views} views
          </p>

          <div className="prose-sm whitespace-pre-wrap text-foreground/90">{detail.description}</div>

          {detail.motivation && (
            <div className="rounded-nested bg-muted/50 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {detail.kind === "RECOMMENDATION" ? "Why this is worth recommending" : "Why this course is needed"}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{detail.motivation}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {detail.skillLevel && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Skill level</dt>
                <dd className="mt-0.5 font-medium">{detail.skillLevel}</dd>
              </div>
            )}
            {detail.instructor && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Instructor</dt>
                <dd className="mt-0.5 font-medium">{detail.instructor}</dd>
              </div>
            )}
            {detail.sourceProvider && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Source</dt>
                <dd className="mt-0.5 font-medium">{detail.sourceProvider}</dd>
              </div>
            )}
          </dl>

          {detail.referenceUrl && (
            <a
              href={detail.referenceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              View reference link
            </a>
          )}

          {detail.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {detail.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/requests?tag=${tag}`}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 pt-5">
            <RequestDetailActions
              requestId={detail.id}
              slug={detail.slug}
              mine={detail.mine}
              initialVoted={detail.votedByMe}
              initialVoteCount={detail.voteCount}
              initialBookmarked={detail.bookmarkedByMe}
              initialFollowed={detail.followedByMe}
            />
          </div>

          {isAdmin && statusEvents.length > 0 && (
            <div className="rounded-nested border border-border/60 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <History className="h-3.5 w-3.5" aria-hidden />
                Status history
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {statusEvents.map((event) => {
                  const meta = event.meta as { from?: string; to?: string } | null;
                  return (
                    <li key={event.id}>
                      {meta?.from && REQUEST_STATUS_LABELS[meta.from as keyof typeof REQUEST_STATUS_LABELS]} →{" "}
                      {meta?.to && REQUEST_STATUS_LABELS[meta.to as keyof typeof REQUEST_STATUS_LABELS]} ·{" "}
                      <span suppressHydrationWarning>{formatDistanceToNow(event.createdAt, { addSuffix: true })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <RequestCommentsSection
          requestId={detail.id}
          initialItems={commentDTOs}
          initialCommentCount={detail.commentCount}
          commentsLocked={detail.commentsLocked}
        />
      </div>
    </Section>
  );
}

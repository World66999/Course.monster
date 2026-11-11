import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ArrowLeft } from "lucide-react";
import { getPublishedResource, attachMyResourceState } from "@/lib/learning-resources";
import { db } from "@/lib/db";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";
import { absoluteUrl, safeJsonLd } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/site/report-dialog";
import { ResourceBookmarkButton } from "@/components/site/learn/resource-bookmark-button";
import { YoutubeEmbed } from "@/components/site/learn/youtube-embed";
import { Markdown } from "@/components/site/markdown";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getPublishedResource(slug);
  if (!resource) return { title: "Resource not found" };
  const thumb = resource.thumbnail || (resource.videoId ? youtubeThumbnailUrl(resource.videoId) : undefined);
  return {
    title: resource.title,
    description: resource.description ?? `A free ${resource.resourceType.toLowerCase()} — ${resource.title}`,
    alternates: { canonical: `/learn/${resource.slug}` },
    openGraph: {
      title: resource.title,
      description: resource.description ?? undefined,
      url: absoluteUrl(`/learn/${resource.slug}`),
      ...(thumb ? { images: [thumb] } : {}),
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LearningResourceDetailPage({ params }: Props) {
  const { slug } = await params;
  const resource = await getPublishedResource(slug);
  if (!resource) notFound();

  db.learningResource.update({ where: { id: resource.id }, data: { views: { increment: 1 } } }).catch(() => undefined);

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const myState = await attachMyResourceState([resource], userId);
  const bookmarked = myState.get(resource.id)!.bookmarked;

  const videoLd = resource.videoId
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: resource.title,
        description: resource.description ?? resource.title,
        thumbnailUrl: resource.thumbnail || youtubeThumbnailUrl(resource.videoId),
        uploadDate: resource.createdAt.toISOString(),
        // Through the same helper the player uses, so the id is encoded once,
        // in one place, rather than interpolated raw into a URL here.
        embedUrl: youtubeEmbedUrl(resource.videoId, { autoplay: false }),
        ...(resource.durationMinutes ? { duration: `PT${resource.durationMinutes}M` } : {}),
      }
    : null;

  return (
    <Section className="max-w-3xl py-12">
      {videoLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(videoLd) }} />
      )}
      <Link href="/learn" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Free Learning Hub
      </Link>

      <div className="rounded-card border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resource.resourceType === "PLAYLIST" ? "secondary" : "default"}>
            {resource.resourceType}
          </Badge>
          {resource.featured && <Badge variant="warning">Featured</Badge>}
          {resource.skillLevel && <Badge variant="secondary">{formatLevel(resource.skillLevel)}</Badge>}
          {resource.category && <Badge variant="secondary">{resource.category.name}</Badge>}
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">{resource.title}</h1>
        {resource.creatorName && <p className="mt-1 text-muted-foreground">by {resource.creatorName}</p>}

        {(resource.videoId || resource.playlistId) && (
          <div className="mt-6">
            <YoutubeEmbed
              videoId={resource.videoId}
              playlistId={resource.playlistId ?? undefined}
              poster={resource.thumbnail}
              title={resource.title}
            />
          </div>
        )}

        {resource.description && (
          <div className="prose-sm mt-6 text-foreground/90">
            <Markdown content={resource.description} />
          </div>
        )}

        {resource.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {resource.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <ResourceBookmarkButton resourceId={resource.id} initialBookmarked={bookmarked} />
          <div className="ml-auto">
            <ReportButton target={{ learningResourceId: resource.id }} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function formatLevel(level: string): string {
  if (level === "ALL_LEVELS") return "All Levels";
  return level.charAt(0) + level.slice(1).toLowerCase();
}

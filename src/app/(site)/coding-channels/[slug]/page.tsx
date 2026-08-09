import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ArrowLeft, BadgeCheck, ExternalLink, Globe } from "lucide-react";
import { getPublishedChannel, attachMyChannelState } from "@/lib/coding-channels";
import { db } from "@/lib/db";
import { absoluteUrl, gradientFromString, cn } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/site/report-dialog";
import { ChannelBookmarkButton } from "@/components/site/coding-channels/channel-bookmark-button";
import { Markdown } from "@/components/site/markdown";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const channel = await getPublishedChannel(slug);
  if (!channel) return { title: "Channel not found" };
  return {
    title: channel.name,
    description: channel.shortDescription ?? `${channel.name} — a curated programming YouTube channel.`,
    alternates: { canonical: `/coding-channels/${channel.slug}` },
    openGraph: {
      title: `${channel.name} — Coding Channels`,
      description: channel.shortDescription ?? undefined,
      url: absoluteUrl(`/coding-channels/${channel.slug}`),
      ...(channel.logo ? { images: [channel.logo] } : {}),
    },
    twitter: { card: "summary" },
  };
}

export default async function CodingChannelDetailPage({ params }: Props) {
  const { slug } = await params;
  const channel = await getPublishedChannel(slug);
  if (!channel) notFound();

  db.codingChannel.update({ where: { id: channel.id }, data: { views: { increment: 1 } } }).catch(() => undefined);

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const myState = await attachMyChannelState([channel], userId);
  const bookmarked = myState.get(channel.id)!.bookmarked;

  const { from, to, light } = gradientFromString(channel.name);
  const initials = channel.name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <Section className="max-w-3xl py-12">
      <Link
        href="/coding-channels"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Coding Channels
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          {channel.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.logo} alt={channel.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            >
              <span className={cn("text-2xl font-bold", light ? "text-slate-900/85" : "text-white/90")}>
                {initials}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{channel.name}</h1>
              {channel.verified && (
                <span className="inline-flex items-center gap-1 text-primary" title="Verified by Courses Monster">
                  <BadgeCheck className="h-5 w-5" aria-hidden />
                </span>
              )}
            </div>
            {channel.shortDescription && <p className="mt-1 text-muted-foreground">{channel.shortDescription}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {channel.featured && <Badge variant="warning">Featured</Badge>}
          {channel.skillLevel && <Badge variant="secondary">{formatLevel(channel.skillLevel)}</Badge>}
          {channel.spokenLanguage && (
            <Badge variant="secondary">
              <Globe className="h-3 w-3" aria-hidden />
              {channel.spokenLanguage}
            </Badge>
          )}
          {channel.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>

        {channel.description && (
          <div className="prose-sm mt-6 whitespace-pre-wrap text-foreground/90">
            <Markdown content={channel.description} />
          </div>
        )}

        {channel.bestSuitedFor && (
          <div className="mt-6 rounded-xl bg-muted/50 p-4">
            <h2 className="text-sm font-semibold">Best suited for</h2>
            <p className="mt-1 text-sm text-muted-foreground">{channel.bestSuitedFor}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <a
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-hover"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Visit Channel
          </a>
          <ChannelBookmarkButton channelId={channel.id} initialBookmarked={bookmarked} />
          <div className="ml-auto">
            <ReportButton target={{ codingChannelId: channel.id }} />
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

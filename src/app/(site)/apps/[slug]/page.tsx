import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/site/brand-icons";
import { getPublishedApp } from "@/lib/apps";
import { db } from "@/lib/db";
import { absoluteUrl, safeJsonLd, gradientFromString, cn } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/site/report-dialog";
import { Markdown } from "@/components/site/markdown";
import { CATEGORY_LABELS, PLATFORM_LABELS } from "@/components/site/apps/app-card";

interface Props {
  params: Promise<{ slug: string }>;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await getPublishedApp(slug);
  if (!app) return { title: "App not found" };
  return {
    title: app.name,
    description: app.shortDescription ?? `${app.name} — download from ${hostnameOf(app.downloadUrl)}.`,
    alternates: { canonical: `/apps/${app.slug}` },
    openGraph: {
      title: app.name,
      description: app.shortDescription ?? undefined,
      url: absoluteUrl(`/apps/${app.slug}`),
      ...(app.icon ? { images: [app.icon] } : {}),
    },
    twitter: { card: "summary" },
  };
}

export default async function AppDetailPage({ params }: Props) {
  const { slug } = await params;
  const app = await getPublishedApp(slug);
  if (!app) notFound();

  db.appListing.update({ where: { id: app.id }, data: { views: { increment: 1 } } }).catch(() => undefined);

  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.shortDescription ?? app.description ?? app.name,
    applicationCategory: CATEGORY_LABELS[app.category] ?? app.category,
    operatingSystem: PLATFORM_LABELS[app.platform] ?? app.platform,
    ...(app.version ? { softwareVersion: app.version } : {}),
    ...(app.icon ? { image: app.icon } : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const { from, to, light } = gradientFromString(app.name);
  const initials = app.name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <Section className="max-w-3xl py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(appLd) }} />
      <Link href="/apps" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Apps Hub
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          {app.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.icon} alt={app.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
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
            <h1 className="text-2xl font-bold tracking-tight">{app.name}</h1>
            {app.developer && <p className="mt-0.5 text-muted-foreground">by {app.developer}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {app.featured && <Badge variant="warning">Featured</Badge>}
          <Badge variant="secondary">{PLATFORM_LABELS[app.platform] ?? app.platform}</Badge>
          <Badge variant="secondary">{CATEGORY_LABELS[app.category] ?? app.category}</Badge>
          {app.isOpenSource && <Badge variant="success">Open Source</Badge>}
          {app.license && <Badge variant="secondary">{app.license}</Badge>}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-3">
          {app.version && (
            <div>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium">{app.version}</dd>
            </div>
          )}
          {app.fileSizeLabel && (
            <div>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-medium">{app.fileSizeLabel}</dd>
            </div>
          )}
          {app.minAndroidVersion && (
            <div>
              <dt className="text-muted-foreground">Min Android</dt>
              <dd className="font-medium">{app.minAndroidVersion}</dd>
            </div>
          )}
          {app.architecture && (
            <div>
              <dt className="text-muted-foreground">Architecture</dt>
              <dd className="font-medium">{app.architecture}</dd>
            </div>
          )}
          {app.appUpdatedAt && (
            <div>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="font-medium">{app.appUpdatedAt.toLocaleDateString()}</dd>
            </div>
          )}
        </dl>

        {app.description && (
          <div className="prose-sm mt-6 text-foreground/90">
            <Markdown content={app.description} />
          </div>
        )}

        {app.screenshots.length > 0 && (
          <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {app.screenshots.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`${app.name} screenshot ${i + 1}`}
                loading="lazy"
                className="h-48 w-auto shrink-0 rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        )}

        {app.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {app.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-3">
          <p className="text-xs text-muted-foreground">
            You&apos;ll be taken to <span className="font-medium text-foreground">{hostnameOf(app.downloadUrl)}</span> to download.
            Courses Monster never hosts app files directly.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={app.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-hover"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download from {hostnameOf(app.downloadUrl)}
            </a>
            {app.projectUrl && (
              <a
                href={app.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Project page
              </a>
            )}
            {app.sourceUrl && (
              <a
                href={app.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <GithubIcon className="h-4 w-4" aria-hidden />
                Source
              </a>
            )}
            <div className="ml-auto">
              <ReportButton target={{ appListingId: app.id }} />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

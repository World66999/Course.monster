import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GENERIC_PAGES } from "@/lib/pages";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/site/markdown";
import { Section } from "@/components/site/section";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

function getMeta(slug: string) {
  return GENERIC_PAGES.find((p) => p.slug === slug);
}

export function generateStaticParams() {
  return GENERIC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = getMeta(slug);
  if (!meta) return {};
  const page = await db.page.findUnique({ where: { slug } });
  return {
    title: page?.title ?? meta.title,
    description: meta.description,
    alternates: { canonical: meta.path },
  };
}

export default async function StandalonePage({ params }: Props) {
  const { slug } = await params;
  const meta = getMeta(slug);
  if (!meta) notFound();

  const page = await db.page.findUnique({ where: { slug } });

  return (
    <Section className="max-w-3xl py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page?.title ?? meta.title}</h1>
      {page ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated {formatDate(page.updatedAt)}
          </p>
          <div className="mt-8">
            <Markdown content={page.content} />
          </div>
        </>
      ) : (
        <p className="mt-8 text-muted-foreground">
          This page hasn&apos;t been written yet. Check back soon.
        </p>
      )}
    </Section>
  );
}

import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Markdown } from "@/components/site/markdown";
import { Section } from "@/components/site/section";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await db.page.findUnique({ where: { slug: "how-to-download" } });
  return {
    title: page?.title ?? "How to Download",
    description: "Step-by-step guide to downloading any course from this site.",
    alternates: { canonical: "/how-to-download" },
  };
}

export default async function HowToDownloadPage() {
  const page = await db.page.findUnique({ where: { slug: "how-to-download" } });

  return (
    <Section className="max-w-3xl py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {page?.title ?? "How to Download"}
      </h1>
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
          This guide hasn&apos;t been written yet. Check back soon.
        </p>
      )}
    </Section>
  );
}

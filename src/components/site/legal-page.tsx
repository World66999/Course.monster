import { Markdown } from "@/components/site/markdown";
import { Section } from "@/components/site/section";
import { formatDate } from "@/lib/utils";
import { LEGAL_UPDATED } from "@/lib/legal-content";

/** Shared layout for the code-defined legal pages. */
export function LegalPage({ title, content }: { title: string; content: string }) {
  return (
    <Section className="max-w-3xl py-16">
      <h1 className="text-title text-balance">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {formatDate(LEGAL_UPDATED)}</p>
      <div className="mt-8">
        <Markdown content={content} />
      </div>
    </Section>
  );
}

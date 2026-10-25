import type { Metadata } from "next";
import { Section } from "@/components/site/section";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { Search, ShieldCheck, Download, Sparkles } from "lucide-react";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "How to Download | Help Center",
    description: "Step-by-step guide to downloading any course from this site.",
    alternates: { canonical: "/how-to-download" },
  };
}

const STEPS = [
  {
    num: "1",
    title: "Find your course",
    description:
      "Browse our extensive library of premium courses or use the search bar to find exactly what you're looking for. No account or signup is required.",
    icon: Search,
  },
  {
    num: "2",
    title: "Quick verification",
    description:
      "Click the download button on the course page. You will be directed through a brief security check to ensure you are human and keep our servers safe.",
    icon: ShieldCheck,
  },
  {
    num: "3",
    title: "Get your files",
    description:
      "Once verified, you'll be granted immediate access to the direct download links. High-speed, unthrottled, and completely free forever.",
    icon: Download,
  },
];

export default function HelpPage() {
  return (
    <>
      <Section className="pt-20 pb-12 text-center sm:pt-28 sm:pb-16">
        <Reveal>
          <div className="mx-auto mb-8 flex max-w-fit items-center justify-center gap-2 rounded-full bg-primary-soft px-5 py-2 ring-1 ring-inset ring-primary/20">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span className="text-eyebrow text-primary uppercase">Help Center</span>
          </div>
          {/* `text-display`, not a hand-rolled 5xl→6xl→7xl→text-heading ladder.
              That ladder ended on `text-heading`, which caps at 1.75rem, so the
              title grew to 72px at md and then collapsed to 28px at lg — smaller
              than the paragraph beneath it. text-display is the token for a page
              this size and already clamps fluidly from 2.5rem to 4.5rem. */}
          <h1 className="text-display mb-6 text-balance">How to download</h1>
          <p className="text-lead mx-auto max-w-2xl text-balance text-muted-foreground">
            Getting your courses is incredibly simple. Follow these three quick steps to get
            instant, free access to premium learning materials.
          </p>
        </Reveal>
      </Section>

      <Section className="pb-24 sm:pb-32">
        <Stagger stagger={0.15} className="mx-auto grid max-w-5xl gap-6 md:gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.num}>
                {/* `surface` rather than `glass-panel`: these cards hold the
                    page's body copy, and they previously nested a second blurred
                    layer (glass-chrome, on the number badge) inside a blurred
                    panel. Transitions are scoped to the properties that actually
                    move, instead of `transition-all`, and run at the system's
                    500ms rather than a sluggish 700ms. */}
                <div className="group surface relative overflow-hidden rounded-feature p-8 transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-floating sm:p-10 md:p-12">
                  {/* Oversized step numeral, purely atmospheric. The parent clips
                      it, so its negative offsets cannot widen the page. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-16 -right-8 text-[14rem] font-black italic text-foreground/[0.03] transition-[color,transform] duration-500 ease-out select-none group-hover:-translate-x-4 group-hover:translate-y-4 group-hover:scale-110 group-hover:text-primary/[0.08] sm:-top-12 sm:-right-4 sm:text-[20rem]"
                  >
                    {step.num}
                  </div>

                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />

                  <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center md:gap-12">
                    {/* Ring uses the theme's own edge token. `ring-white/10` was
                        invisible against a light card and only ever read in dark
                        mode. */}
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border shadow-soft inset-shadow-highlight transition-[transform,box-shadow] duration-500 group-hover:scale-110 group-hover:ring-primary/40 sm:h-28 sm:w-28">
                      <span className="bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-4xl font-bold text-transparent transition-colors duration-500 group-hover:from-primary group-hover:to-primary/50 sm:text-5xl">
                        {step.num}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-4 flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-nested bg-primary/10 text-primary transition-[background-color,color,box-shadow] duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
                          <Icon className="h-6 w-6" aria-hidden />
                        </div>
                        <h2 className="text-heading text-balance">{step.title}</h2>
                      </div>
                      <p className="text-lead max-w-2xl text-pretty text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Section>
    </>
  );
}

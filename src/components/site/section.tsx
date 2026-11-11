import Link from "next/link";
import { ArrowRight, SearchX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page-width container. `rhythm` replaces the previous situation where every
 * section on the homepage was `py-14`, which gave a featured grid exactly the
 * same weight as a footnote and left the page with no vertical hierarchy.
 */
export function Section({
  className,
  rhythm = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { rhythm?: "none" | "tight" | "default" | "loose" }) {
  const rhythms = {
    none: "",
    tight: "py-10 sm:py-12",
    default: "py-14 sm:py-20",
    loose: "py-20 sm:py-28",
  } as const;
  return (
    <section
      className={cn("page-gutter mx-auto w-full max-w-7xl", rhythms[rhythm], className)}
      {...props}
    >
      {children}
    </section>
  );
}

/** Small pill label above a heading: a citrus dot plus letter-spaced text. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-eyebrow text-primary uppercase ring-1 ring-inset ring-primary/15",
        className
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-accent/30" />
      {children}
    </p>
  );
}

/**
 * Section header. The eyebrow is the piece that was missing: a small
 * letter-spaced label above the title gives the eye a fixed entry point and is
 * most of why editorial layouts read as designed rather than dumped.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel = "View all",
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex gap-4 sm:mb-10",
        align === "center" ? "flex-col items-center text-center" : "items-end justify-between",
        className
      )}
    >
      <div className={cn("min-w-0", align === "center" && "max-w-2xl")}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-heading text-balance">{title}</h2>
        {subtitle && (
          <p className="mt-3 max-w-prose text-pretty text-muted-foreground sm:text-lg">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group hidden shrink-0 items-center gap-2 rounded-full border border-border bg-card py-2 pr-2 pl-4 text-sm font-semibold shadow-soft transition-[border-color,box-shadow,color] duration-300 hover:border-primary/40 hover:text-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
        >
          {linkLabel}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-rotate-45">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>
      )}
    </div>
  );
}

/**
 * Page-level header. Fourteen routes were each hand-rolling
 * `text-3xl font-bold tracking-tight sm:text-4xl` plus a muted paragraph, so
 * every listing page had subtly its own idea of what a page title looks like
 * and none of them had an eyebrow. `actions` keeps the primary CTA on the
 * title row where a page has one.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-10",
        className
      )}
    >
      {/* Ambient band behind every page title. It bleeds past the container on
          purpose so a listing page opens with the same atmosphere as the home
          hero instead of starting on flat background. Purely decorative and
          pointer-transparent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 -bottom-10 -z-10 bg-[radial-gradient(36rem_16rem_at_10%_30%,var(--wash-1),transparent_70%),radial-gradient(28rem_14rem_at_70%_10%,var(--wash-3),transparent_70%)]"
      />
      {/* CSS-only entrance (`rise-in`): page titles are above the fold, where a
          scroll reveal would have nothing to wait for. */}
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="rise-in">{eyebrow}</Eyebrow>}
        <h1 className="rise-in text-title text-balance" style={{ "--d": "60ms" } as React.CSSProperties}>
          {title}
        </h1>
        {description && (
          <p
            className="rise-in mt-3 max-w-2xl text-pretty text-muted-foreground sm:text-lg"
            style={{ "--d": "140ms" } as React.CSSProperties}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div
          className="rise-in flex max-w-full min-w-0 flex-wrap items-center gap-3"
          style={{ "--d": "200ms" } as React.CSSProperties}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

const stateTones = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary-soft text-primary ring-primary/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  destructive: "bg-destructive-soft text-destructive ring-destructive/20",
} as const;

/**
 * Shared shell for every "nothing here" surface — empty, no-results, error,
 * permission-denied. Routing them all through one component is what stops the
 * app growing four different-looking dead ends.
 */
function StateShell({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  tone?: keyof typeof stateTones;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-panel",
        "border border-dashed border-border bg-card/60 px-6 py-16 text-center",
        className
      )}
    >
      <div className="bg-aurora pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative flex flex-col items-center">
        {icon && (
          <div
            className={cn(
              "mb-5 flex h-14 w-14 items-center justify-center rounded-panel ring-1 ring-inset",
              "shadow-soft inset-shadow-highlight [&>svg]:h-6 [&>svg]:w-6",
              stateTones[tone]
            )}
          >
            {icon}
          </div>
        )}
        <h3 className="text-subheading">{title}</h3>
        {description && (
          <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState(props: React.ComponentProps<typeof StateShell>) {
  return <StateShell {...props} />;
}

/** Empty-because-the-filters-excluded-everything, which needs a way back. */
export function NoResultsState({
  query,
  onReset,
  className,
}: {
  query?: string;
  onReset?: React.ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon={<SearchX />}
      title={query ? `No matches for “${query}”` : "No matches"}
      description="Try a different spelling, drop a filter, or browse everything instead."
      action={onReset}
      className={className}
    />
  );
}

/** Inline failure state for a section that could not load. */
export function ErrorState({
  title = "Couldn’t load this",
  description = "Something went wrong on our side. Trying again usually fixes it.",
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon={<TriangleAlert />}
      tone="destructive"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

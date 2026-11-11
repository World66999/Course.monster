"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, Crown, History, Trash2, X } from "lucide-react";
import { clearList, pushRecent, removeFrom, useLibrary, type LibraryInput, type LibraryItem } from "@/lib/library";
import { CourseImage } from "@/components/site/course-image";
import { EmptyState } from "@/components/site/section";
import { buttonClasses } from "@/components/ui/button";
import { cn, textLang } from "@/lib/utils";

/** Records a course-page visit in "Recently viewed" (this browser only). */
export function TrackRecent({ course }: { course: LibraryInput }) {
  const { slug, title, thumbnail, category, premium } = course;
  React.useEffect(() => {
    pushRecent({ slug, title, thumbnail, category, premium });
  }, [slug, title, thumbnail, category, premium]);
  return null;
}

/** Compact card drawn from a stored snapshot; the whole card is one link. */
function LibraryCard({ item, onRemove }: { item: LibraryItem; onRemove?: () => void }) {
  return (
    <div className="group surface relative flex h-full flex-col overflow-hidden rounded-card p-2 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-glow">
      <div className="relative aspect-video overflow-hidden rounded-nested bg-muted">
        <CourseImage src={item.thumbnail} title={item.title} />
        {item.premium && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-accent-foreground shadow-soft">
            <Crown className="h-3 w-3" aria-hidden /> Premium
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-2 pt-3 pb-1.5">
        <h3 lang={textLang(item.title)} className="font-display line-clamp-2 text-[0.95rem] leading-snug font-bold">
          <Link
            href={`/courses/${item.slug}`}
            className="after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {item.title}
          </Link>
        </h3>
        {item.category && <p className="mt-1 truncate text-xs text-muted-foreground">{item.category}</p>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          className="tap-target absolute top-3.5 right-3.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4";

/**
 * "Pick up where you left off" on the home page. Renders nothing at all until
 * this browser has viewed a course, and it sits below the first screen, so it
 * can appear after hydration without shifting anything in view.
 */
export function RecentRail({ className }: { className?: string }) {
  const recent = useLibrary("recent");
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className={cn("page-gutter mx-auto w-full max-w-7xl py-10 sm:py-12", className)}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-eyebrow text-primary uppercase">
            <History className="h-3.5 w-3.5" aria-hidden /> On this device
          </p>
          <h2 id="recent-heading" className="text-heading">
            Pick up where you left off
          </h2>
        </div>
        <Link href="/saved" className={buttonClasses("outline", "sm", "shrink-0")}>
          <Bookmark className="h-3.5 w-3.5" aria-hidden /> Saved
        </Link>
      </div>
      <div className={GRID}>
        {recent.slice(0, 4).map((item) => (
          <LibraryCard key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
}

/** The /saved page: two lists with remove and clear, and honest empty states. */
export function LibraryPage() {
  const saved = useLibrary("saved");
  const recent = useLibrary("recent");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={GRID} aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton aspect-[4/3] rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-14">
      <section aria-labelledby="saved-heading">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="saved-heading" className="flex items-center gap-2 text-subheading">
            <Bookmark className="h-5 w-5 text-primary" aria-hidden /> Saved courses
            <span className="numeric rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {saved.length}
            </span>
          </h2>
          {saved.length > 0 && (
            <button type="button" onClick={() => clearList("saved")} className={buttonClasses("ghost", "sm")}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
            </button>
          )}
        </div>
        {saved.length === 0 ? (
          <EmptyState
            icon={<Bookmark aria-hidden />}
            tone="primary"
            title="Nothing saved yet"
            description="Tap the bookmark on any course to keep it here. It stays on this device, no account needed."
            action={
              <Link href="/courses" className={buttonClasses("primary", "md")}>
                Browse courses
              </Link>
            }
          />
        ) : (
          <div className={GRID}>
            {saved.map((item) => (
              <LibraryCard key={item.slug} item={item} onRemove={() => removeFrom("saved", item.slug)} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="viewed-heading">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="viewed-heading" className="flex items-center gap-2 text-subheading">
            <History className="h-5 w-5 text-primary" aria-hidden /> Recently viewed
          </h2>
          {recent.length > 0 && (
            <button type="button" onClick={() => clearList("recent")} className={buttonClasses("ghost", "sm")}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<History aria-hidden />}
            title="No history yet"
            description="Courses you open will show up here so you can find them again quickly."
          />
        ) : (
          <div className={GRID}>
            {recent.map((item) => (
              <LibraryCard key={item.slug} item={item} onRemove={() => removeFrom("recent", item.slug)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Header shortcut to /saved, with a count once something is saved. */
export function SavedLink({ className }: { className?: string }) {
  const count = useLibrary("saved").length;
  return (
    <Link
      href="/saved"
      prefetch={false}
      aria-label={count > 0 ? `Saved courses (${count})` : "Saved courses"}
      className={cn(
        "tap-target relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Bookmark className="h-4.5 w-4.5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="numeric absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

import { cn, gradientFromString } from "@/lib/utils";

/**
 * Course artwork. Uploaded images are pre-optimized WebP served from
 * /uploads (see src/lib/uploads.ts), so a plain img tag with lazy loading
 * is the right tool; when no image is set we render a branded gradient
 * with the course initials so cards never look broken.
 *
 * There is deliberately no `sizes`/`srcset`: the upload pipeline stores exactly
 * one variant per kind (thumbnails are 800px WebP), so there is no candidate set
 * for the browser to choose from and a `sizes` attribute is inert — it used to be
 * passed in and threaded through here, implying responsive images that were never
 * generated. 800px is a deliberate single-size compromise: it is about right for
 * a full-width card on a 2-3x DPR phone and still comfortably covers the ~350px
 * slot a 4-up desktop grid gives it.
 */
export function CourseImage({
 src,
 title,
 className,
 priority = false,
 loading: loadingProp,
}: {
 src?: string | null;
 title: string;
 className?: string;
 priority?: boolean;
 loading?: "lazy" | "eager";
}) {
 const loading = loadingProp ?? (priority ? "eager" : "lazy");

 if (src) {
 return (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={src}
 alt={title}
 loading={loading}
 // Promotes the above-the-fold thumbnails out of the low-priority bucket
 // that images default to, which is what `priority` is for here.
 fetchPriority={priority ? "high" : undefined}
 decoding="async"
 className={cn("h-full w-full object-cover", className)}
 />
 );
 }

 const { from, to, light } = gradientFromString(title);
 const initials = title
 .split(/\s+/)
 .filter((w) => /^[a-zA-Z0-9]/.test(w))
 .slice(0, 2)
 .map((w) => w[0]!.toUpperCase())
 .join("");

 return (
 <div
 role="img"
 aria-label={title}
 className={cn("flex h-full w-full items-center justify-center", className)}
 style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
 >
 <span
 className={cn(
 "text-3xl font-bold tracking-tight select-none",
 light ? "text-slate-900/85" : "text-white/90"
 )}
 >
 {initials}
 </span>
 </div>
 );
}

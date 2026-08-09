import { cn, gradientFromString } from "@/lib/utils";

/**
 * Course artwork. Uploaded images are pre-optimized WebP served from
 * /uploads (see src/lib/uploads.ts), so a plain img tag with lazy loading
 * is the right tool; when no image is set we render a branded gradient
 * with the course initials so cards never look broken.
 */
export function CourseImage({
  src,
  title,
  className,
  priority = false,
  sizes,
}: {
  src?: string | null;
  title: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
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

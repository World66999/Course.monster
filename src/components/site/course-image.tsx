import { cn, gradientFromString } from "@/lib/utils";
import { UploadPicture } from "@/components/site/upload-picture";

/** `sizes` for a card in the standard 1/2/3/4-column course grid. */
export const CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw";

/**
 * Course artwork.
 *
 * Uploaded images go through UploadPicture (AVIF, then WebP, then JPEG, in
 * several widths). `sizes` says how wide the image is shown; pass it wherever
 * the slot is not a grid card.
 *
 * `priority` is for the one image that is the page's largest above-the-fold
 * element: it loads eagerly at high priority and is preloaded from `<head>`.
 * Everything else is lazy. When no image is set we render a branded gradient
 * with the course initials so cards never look broken.
 */
export function CourseImage({
  src,
  title,
  className,
  priority = false,
  loading: loadingProp,
  sizes = CARD_SIZES,
}: {
  src?: string | null;
  title: string;
  className?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  sizes?: string;
}) {
  if (src) {
    return (
      <UploadPicture
        src={src}
        alt={title}
        sizes={sizes}
        loading={loadingProp}
        priority={priority}
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

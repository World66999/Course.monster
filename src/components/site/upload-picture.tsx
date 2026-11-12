import { preload } from "react-dom";
import { imageSources } from "@/lib/image-variants";

/**
 * An image that may be one of our uploads.
 *
 * Uploads are stored as WebP and have generated AVIF and smaller-size copies
 * beside them (src/lib/image-variants.ts). For those this renders a
 * `<picture>`: AVIF first, then WebP, then a JPEG/PNG for anything older, each
 * with a width list so a phone downloads a phone-sized file. `sizes` says how
 * wide the image is shown. Anything else (an external URL, a hand-placed file)
 * renders as the plain `<img>` it always was.
 *
 * `priority` is for the one image that is a page's largest above-the-fold
 * element: it loads eagerly at high priority and is preloaded from `<head>`.
 */
export function UploadPicture({
  src,
  alt,
  sizes,
  className,
  loading: loadingProp,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
}) {
  const sources = imageSources(src);
  if (priority) {
    // Lets the browser start the download before it has parsed the body. With
    // `type`, a browser that cannot show AVIF skips the hint and picks its own
    // file from the <picture> below.
    if (sources) {
      preload(src, { as: "image", type: "image/avif", imageSrcSet: sources.avifSrcSet, imageSizes: sizes, fetchPriority: "high" });
    } else {
      preload(src, { as: "image", fetchPriority: "high" });
    }
  }
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources ? sources.fallback : src}
      alt={alt}
      loading={loadingProp ?? (priority ? "eager" : "lazy")}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
  if (!sources) return img;
  return (
    // `contents`: the <picture> box disappears and the <img> is laid out as a
    // direct child of whatever frame the caller provides.
    <picture className="contents">
      <source type="image/avif" srcSet={sources.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={sources.webpSrcSet} sizes={sizes} />
      {img}
    </picture>
  );
}

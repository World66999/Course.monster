/**
 * Generates the AVIF, smaller-size and fallback copies for every uploaded
 * image that does not have them yet (see src/lib/image-variants.ts).
 *
 *   UPLOAD_DIR=/path/to/uploads npx tsx scripts/generate-image-variants.ts
 *
 * Safe to run any number of times: existing files are left alone and nothing
 * is ever deleted or overwritten. scripts/deploy.sh runs it on every deploy.
 */
import { generateAllVariants } from "../src/lib/image-variant-writer";
import { uploadDir } from "../src/lib/upload-path";

const started = Date.now();
generateAllVariants((line) => console.log("  " + line))
  .then(({ originals, written }) => {
    console.log(`image variants: ${written} file(s) written for ${originals} image(s) in ${uploadDir()} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  })
  .catch((err) => {
    console.error("image variants: failed:", err);
    process.exit(1);
  });

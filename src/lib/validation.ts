import { z } from "zod";

const urlOrEmpty = z.union([z.string().url("Must be a valid URL"), z.literal("")]);
/** Local upload path (/uploads/...) or absolute URL. */
const imageRef = z.union([
  z.string().url("Must be a valid URL"),
  z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/),
  z.literal(""),
]);

export const courseFormSchema = z.object({
  title: z.string().min(3, "Title is required").max(160),
  slug: z
    .string()
    .min(3)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  shortDescription: z.string().max(220).optional().default(""),
  description: z.string().min(10, "Description is required").max(50_000),
  thumbnail: imageRef.optional().default(""),
  banner: imageRef.optional().default(""),
  categoryId: z.string().max(64).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  downloadUrl: z.string().url("A valid download URL is required").max(2000),
  telegramUrl: urlOrEmpty.optional().default(""),
  sizeLabel: z.string().max(30).optional().default(""),
  lecturesCount: z.coerce.number().int().min(0).max(100_000).optional(),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  trending: z.boolean().default(false),
  seoTitle: z.string().max(70).optional().default(""),
  seoDescription: z.string().max(200).optional().default(""),
  metaImage: imageRef.optional().default(""),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().max(300).optional().default(""),
  icon: z.string().max(40).optional().default(""),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const pageFormSchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(1).max(100_000),
});

export const newsletterSchema = z.object({
  email: z.string().email("Enter a valid email").max(200),
});

export const listCoursesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(64).optional(),
  tag: z.string().max(64).optional(),
  sort: z.enum(["newest", "oldest", "popular", "az"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

/** Turn a comma-separated tag string into a clean array. */
export function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0 && t.length <= 40)
    ),
  ].slice(0, 15);
}

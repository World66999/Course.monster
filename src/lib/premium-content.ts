import { z } from "zod";
import { isSafeExternalUrl, SAFE_URL_MESSAGE } from "@/lib/safe-url";

/**
 * Shared shapes for Premium Resources / Premium Chats: admin form schemas and
 * the icon allowlist. Client-safe (no server imports).
 */

/** Category icons are chosen from this list, never free-form markup. */
export const PREMIUM_ICON_KEYS = [
  "code",
  "sparkles",
  "github",
  "graduation",
  "gem",
  "layers",
  "bot",
  "book",
  "rocket",
  "wrench",
] as const;
export type PremiumIconKey = (typeof PREMIUM_ICON_KEYS)[number];

const slug = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

export const premiumCategorySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  slug,
  description: z.string().trim().max(300).optional().default(""),
  icon: z.union([z.enum(PREMIUM_ICON_KEYS), z.literal("")]).optional().default(""),
  order: z.number().int().min(0).max(100_000).optional().default(0),
});

export const premiumResourceSchema = z.object({
  categoryId: z.string().cuid("Pick a category"),
  title: z.string().trim().min(3, "Title is required").max(140),
  summary: z.string().trim().min(10, "A short public summary is required").max(400),
  content: z.string().trim().min(10, "Content is required").max(50_000),
  url: z
    .union([z.string().url("Must be a valid URL").max(2000).refine(isSafeExternalUrl, SAFE_URL_MESSAGE), z.literal("")])
    .optional()
    .default(""),
  tags: z.string().max(300).optional().default(""),
  published: z.boolean().default(false),
  order: z.number().int().min(0).max(100_000).optional().default(0),
});

export const premiumChatSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(100),
    description: z.string().trim().min(10, "Description is required").max(400),
    category: z.string().trim().min(2, "Category is required").max(40),
    kind: z.enum(["WEB_ROOM", "TELEGRAM_GROUP"]),
    telegramChatId: z
      .string()
      .trim()
      .regex(/^$|^-?\d{5,20}$/, "Telegram chat ids are numbers, e.g. -1001234567890")
      .optional()
      .default(""),
    published: z.boolean().default(false),
    order: z.number().int().min(0).max(100_000).optional().default(0),
  })
  .refine((v) => v.kind !== "TELEGRAM_GROUP" || v.telegramChatId.length > 0, {
    message: "A Telegram group needs its chat id",
    path: ["telegramChatId"],
  });

export type PremiumCategoryInput = z.input<typeof premiumCategorySchema>;
export type PremiumResourceInput = z.input<typeof premiumResourceSchema>;
export type PremiumChatInput = z.input<typeof premiumChatSchema>;

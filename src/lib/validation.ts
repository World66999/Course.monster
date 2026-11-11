import { z } from "zod";

// Zod normally probes whether it may compile validators with `new Function`.
// The site's Content-Security-Policy forbids that (no 'unsafe-eval'), so the
// probe only produced a CSP violation in the browser console (Firefox reports
// it as an error). Interpreted validation is plenty fast for form-sized input.
z.config({ jitless: true });
import { isYoutubeUrl } from "@/lib/youtube";
import { isSafeExternalUrl, SAFE_URL_MESSAGE } from "@/lib/safe-url";
import {
  EXTERNAL_URL_MESSAGE,
  isStorableExternalUrl,
  normalizeExternalUrl,
} from "@/lib/external-resource";

/**
 * Every URL field here ends up as an `href`, an `src`, or a redirect target,
 * so they all get the same scheme/authority check. Admin-only fields are not
 * exempt: the account that *sets* a `javascript:` URI is trusted, but the
 * visitors it executes for are not.
 */
const urlOrEmpty = z.union([
  z.string().url("Must be a valid URL").refine(isSafeExternalUrl, SAFE_URL_MESSAGE),
  z.literal(""),
]);
const httpUrlOrEmpty = urlOrEmpty;
/**
 * Stricter still than httpUrlOrEmpty: must be an https/http URL AND parse as
 * a recognizable YouTube video/playlist/channel URL — used for the one
 * class of external link this app actually embeds content from.
 */
const youtubeUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .max(500)
  .refine(isSafeExternalUrl, SAFE_URL_MESSAGE)
  .refine((v) => isYoutubeUrl(v), "Must be a YouTube video, playlist or channel URL");

/**
 * A query-string boolean.
 *
 * NOT `z.coerce.boolean()`, which is `Boolean(value)` — every non-empty string
 * is truthy there, so `?bookmarked=false` and `?openSource=0` both parsed as
 * TRUE and silently inverted the filter (the user asked to turn a filter off
 * and got it turned on). The site's own controls drop the parameter instead of
 * writing `=false`, which is why this stayed hidden, but hand-edited, shared
 * and bookmarked URLs do carry it.
 *
 * Only the explicit true spellings are true; "false"/"0"/"no"/"" are false.
 */
const booleanFlag = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["true", "1", "yes", "on"].includes(v.trim().toLowerCase())));

/** Local upload path (/uploads/...) or absolute URL. */
const imageRef = z.union([
  z.string().url("Must be a valid URL").refine(isSafeExternalUrl, SAFE_URL_MESSAGE),
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
  downloadUrl: z
    .string()
    .url("A valid download URL is required")
    .max(2000)
    .refine(isSafeExternalUrl, SAFE_URL_MESSAGE),
  telegramUrl: urlOrEmpty.optional().default(""),
  sizeLabel: z.string().max(30).optional().default(""),
  lecturesCount: z.coerce.number().int().min(0).max(100_000).optional(),
  skillLevel: z
    .union([z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]), z.literal("")])
    .optional()
    .default(""),
  language: z.string().max(40).optional().default(""),
  durationHours: z.coerce.number().min(0).max(10_000).optional(),
  instructor: z.string().max(120).optional().default(""),
  publisher: z.string().max(120).optional().default(""),
  sourceUrl: urlOrEmpty.optional().default(""),
  prerequisites: z.string().max(2_000).optional().default(""),
  learningOutcomes: z.string().max(4_000).optional().default(""),
  certificate: z.enum(["unset", "yes", "no"]).optional().default("unset"),
  lifetimeAccess: z.enum(["unset", "yes", "no"]).optional().default("unset"),
  /**
   * Announced availability date, surfaced by the Telegram bot's "Upcoming"
   * section. Empty means "not upcoming" — nothing infers a date.
   */
  availableAt: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use the date picker (YYYY-MM-DD)")
    .optional()
    .default(""),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  trending: z.boolean().default(false),
  popular: z.boolean().default(false),
  premium: z.boolean().default(false),
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
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  lang: z.string().max(40).optional(),
  duration: z.enum(["short", "medium", "long"]).optional(),
  flag: z.enum(["featured", "trending", "popular"]).optional(),
  sort: z.enum(["newest", "oldest", "popular", "az"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

const cuid = z.string().cuid();

export const commentFormSchema = z.object({
  courseId: cuid,
  parentId: cuid.optional(),
  // Structural bounds only — the real min/max come from admin Settings and
  // are enforced in the server action (they're runtime-configurable).
  body: z.string().trim().min(1).max(10_000),
});
export type CommentFormValues = z.infer<typeof commentFormSchema>;

export const reviewFormSchema = z.object({
  courseId: cuid,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(1).max(20_000),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const reportReasonEnum = z.enum(["SPAM", "ABUSE", "HARASSMENT", "OFF_TOPIC", "OTHER"]);

export const reportFormSchema = z.object({
  commentId: cuid.optional(),
  reviewId: cuid.optional(),
  chatMessageId: cuid.optional(),
  courseRequestId: cuid.optional(),
  requestCommentId: cuid.optional(),
  codingChannelId: cuid.optional(),
  learningResourceId: cuid.optional(),
  appListingId: cuid.optional(),
  reason: reportReasonEnum,
  note: z.string().trim().max(500).optional().default(""),
});
export type ReportFormValues = z.infer<typeof reportFormSchema>;

// --- Chat ---

export const chatMessageFormSchema = z.object({
  parentId: cuid.optional(),
  // Structural bounds only — real min/max come from admin Settings and are
  // enforced in the server action (same convention as commentFormSchema).
  body: z.string().trim().max(4_000),
  imageUrl: z
    .string()
    .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/)
    .optional(),
  imageThumbUrl: z
    .string()
    .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/)
    .optional(),
});
export type ChatMessageFormValues = z.infer<typeof chatMessageFormSchema>;

export const chatReactionSchema = z.object({
  messageId: cuid,
  // Allowlist-checked server-side against CHAT_EMOJI (src/lib/chat.ts) — this
  // is only a structural bound so a huge string can't reach the DB layer.
  emoji: z.string().min(1).max(8),
});
export type ChatReactionValues = z.infer<typeof chatReactionSchema>;

export const listChatMessagesQuerySchema = z.object({
  before: z.string().max(64).optional(),
  after: z.string().max(64).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
  /** ISO timestamp of the client's last poll — used to compute `removedIds`. */
  since: z.coerce.date().optional(),
});
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;

/** Either courseId (top-level list) or parentId (replies to one comment) — validated in the route. */
export const listCommentsQuerySchema = z.object({
  courseId: cuid.optional(),
  parentId: cuid.optional(),
  sort: z.enum(["newest", "oldest", "helpful"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
});
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

export const listReviewsQuerySchema = z.object({
  courseId: cuid,
  sort: z.enum(["newest", "oldest", "highest", "lowest"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

// --- Course Requests ---

export const requestSkillLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const requestStatusEnum = z.enum([
  "REQUESTED",
  "IN_PROGRESS",
  "AVAILABLE",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
]);
export const requestKindEnum = z.enum(["REQUEST", "RECOMMENDATION"]);

export const courseRequestFormSchema = z.object({
  kind: requestKindEnum.optional().default("REQUEST"),
  title: z.string().trim().min(3, "Title is required").max(160),
  categoryId: cuid.optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Subject is required").max(120),
  // Structural bounds only — real min/max come from admin Settings and are
  // enforced in the server action (same convention as commentFormSchema).
  description: z.string().trim().max(20_000),
  motivation: z.string().trim().max(4_000).optional().default(""),
  skillLevel: z.union([requestSkillLevelEnum, z.literal("")]).optional().default(""),
  instructor: z.string().trim().max(120).optional().default(""),
  sourceProvider: z.string().trim().max(120).optional().default(""),
  referenceUrl: httpUrlOrEmpty.optional().default(""),
  // Comma-separated on the wire, same convention as courseFormSchema.tags.
  tags: z.string().max(300).optional().default(""),
  imageUrl: z
    .string()
    .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/)
    .optional(),
  imageThumbUrl: z
    .string()
    .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/)
    .optional(),
  anonymous: z.boolean().optional().default(false),
});
export type CourseRequestFormValues = z.infer<typeof courseRequestFormSchema>;

export const requestCommentFormSchema = z.object({
  requestId: cuid,
  parentId: cuid.optional(),
  body: z.string().trim().max(10_000),
});
export type RequestCommentFormValues = z.infer<typeof requestCommentFormSchema>;

export const requestCommentReactionSchema = z.object({
  commentId: cuid,
  // Allowlist-checked server-side against CHAT_EMOJI — this is only a
  // structural bound so a huge string can't reach the DB layer.
  emoji: z.string().min(1).max(8),
});

export const listCourseRequestsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(64).optional(),
  tag: z.string().max(64).optional(),
  level: requestSkillLevelEnum.optional(),
  status: requestStatusEnum.optional(),
  kind: requestKindEnum.optional(),
  sort: z.enum(["trending", "newest", "popular", "updated"]).optional().default("newest"),
  mine: booleanFlag.optional(),
  bookmarked: booleanFlag.optional(),
  following: booleanFlag.optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListCourseRequestsQuery = z.infer<typeof listCourseRequestsQuerySchema>;

export const listRequestCommentsQuerySchema = z.object({
  requestId: cuid.optional(),
  parentId: cuid.optional(),
  cursor: z.string().max(64).optional(),
});

// --- Coding Channels / Free Learning Hub / Apps Hub (admin-curated) ---

export const learningLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"]);

export const codingChannelFormSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  slug: z
    .string()
    .min(2)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  url: youtubeUrlSchema,
  logo: imageRef.optional().default(""),
  shortDescription: z.string().max(220).optional().default(""),
  description: z.string().max(20_000).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  spokenLanguage: z.string().max(40).optional().default(""),
  skillLevel: z.union([learningLevelEnum, z.literal("")]).optional().default(""),
  bestSuitedFor: z.string().max(300).optional().default(""),
  featured: z.boolean().default(false),
  verified: z.boolean().default(true),
  published: z.boolean().default(false),
});
export type CodingChannelFormValues = z.infer<typeof codingChannelFormSchema>;

export const listCodingChannelsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  tag: z.string().max(64).optional(),
  level: learningLevelEnum.optional(),
  lang: z.string().max(40).optional(),
  flag: z.enum(["featured", "verified"]).optional(),
  bookmarked: booleanFlag.optional(),
  sort: z.enum(["newest", "popular", "az"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListCodingChannelsQuery = z.infer<typeof listCodingChannelsQuerySchema>;

export const learningResourceTypeEnum = z.enum(["VIDEO", "PLAYLIST"]);

export const learningResourceFormSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  slug: z
    .string()
    .min(2)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  url: youtubeUrlSchema,
  resourceType: learningResourceTypeEnum,
  description: z.string().max(20_000).optional().default(""),
  thumbnail: imageRef.optional().default(""),
  creatorName: z.string().max(120).optional().default(""),
  categoryId: z.string().max(64).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  skillLevel: z.union([learningLevelEnum, z.literal("")]).optional().default(""),
  spokenLanguage: z.string().max(40).optional().default(""),
  durationMinutes: z.coerce.number().int().min(0).max(100_000).optional(),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
});
export type LearningResourceFormValues = z.infer<typeof learningResourceFormSchema>;

export const listLearningResourcesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(64).optional(),
  tag: z.string().max(64).optional(),
  level: learningLevelEnum.optional(),
  lang: z.string().max(40).optional(),
  type: learningResourceTypeEnum.optional(),
  flag: z.enum(["featured"]).optional(),
  bookmarked: booleanFlag.optional(),
  sort: z.enum(["newest", "popular"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListLearningResourcesQuery = z.infer<typeof listLearningResourcesQuerySchema>;

export const appCategoryEnum = z.enum([
  "DEVELOPER_TOOLS",
  "PROGRAMMING",
  "EDUCATION",
  "PRODUCTIVITY",
  "UTILITIES",
  "OPEN_SOURCE",
  "MEDIA_TOOLS",
  "FILE_MANAGEMENT",
  "PRIVACY_TOOLS",
  "NETWORKING",
  "OTHER",
]);

export const appPlatformEnum = z.enum([
  "ANDROID",
  "WINDOWS",
  "MACOS",
  "LINUX",
  "WEB",
  "IOS",
  "CROSS_PLATFORM",
]);

export const appListingFormSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  slug: z
    .string()
    .min(2)
    .max(96)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  icon: imageRef.optional().default(""),
  screenshots: z.array(imageRef).max(10).optional().default([]),
  shortDescription: z.string().max(220).optional().default(""),
  description: z.string().max(20_000).optional().default(""),
  developer: z.string().max(120).optional().default(""),
  projectUrl: httpUrlOrEmpty.optional().default(""),
  sourceUrl: httpUrlOrEmpty.optional().default(""),
  downloadUrl: z
    .string()
    .url("A valid download URL is required")
    .max(2000)
    .refine(isSafeExternalUrl, SAFE_URL_MESSAGE)
    .refine((v) => /^https:\/\//i.test(v), "Must be an https:// URL"),
  platform: appPlatformEnum,
  category: appCategoryEnum,
  version: z.string().max(40).optional().default(""),
  appUpdatedAt: z.string().max(20).optional().default(""),
  license: z.string().max(60).optional().default(""),
  isOpenSource: z.boolean().default(false),
  minAndroidVersion: z.string().max(20).optional().default(""),
  architecture: z.string().max(40).optional().default(""),
  fileSizeLabel: z.string().max(30).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
});
export type AppListingFormValues = z.infer<typeof appListingFormSchema>;

export const listAppListingsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: appCategoryEnum.optional(),
  platform: appPlatformEnum.optional(),
  openSource: booleanFlag.optional(),
  flag: z.enum(["featured"]).optional(),
  sort: z.enum(["newest", "popular", "az"]).optional().default("newest"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListAppListingsQuery = z.infer<typeof listAppListingsQuerySchema>;

export const fetchYoutubeMetaSchema = z.object({
  url: youtubeUrlSchema,
});

// --- Free Resources + Free AI Platforms (admin-curated, link-out only) ---

/**
 * Outbound URL for both new sections: https only, no credentials, and
 * canonicalized before it is ever stored. Stricter than `urlOrEmpty` above,
 * which still permits http — see src/lib/external-resource.ts for why.
 *
 * `.transform` runs after the refinement, so the value that reaches the server
 * action is already normalized; the action never has to remember to do it.
 */
const externalResourceUrl = z
  .string()
  .trim()
  .min(1, "A URL is required")
  .max(2000)
  .refine(isStorableExternalUrl, EXTERNAL_URL_MESSAGE)
  .transform((v) => normalizeExternalUrl(v)!);

export const resourceCategoryEnum = z.enum([
  "DOCUMENTATION",
  "COURSE",
  "EBOOK",
  "TOOL",
  "DATASET",
  "CHEATSHEET",
  "COMMUNITY",
  "OTHER",
]);

/**
 * Note there is no `sourceType` here: it is derived from the URL's hostname
 * server-side and is deliberately not accepted from the client, so a form
 * post cannot make a row claim a platform it does not belong to.
 */
export const freeResourceFormSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(160),
  description: z.string().trim().max(2_000).optional().default(""),
  url: externalResourceUrl,
  category: resourceCategoryEnum,
  thumbnail: imageRef.optional().default(""),
  tags: z.string().max(500).optional().default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});
export type FreeResourceFormValues = z.infer<typeof freeResourceFormSchema>;

export const resourceSourceTypeEnum = z.enum([
  "MEGA",
  "TELEGRAM",
  "GOOGLE_DRIVE",
  "GITHUB",
  "DROPBOX",
  "ONEDRIVE",
  "YOUTUBE",
  "ARCHIVE_ORG",
  "WEBSITE",
]);

export const listFreeResourcesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: resourceCategoryEnum.optional(),
  source: resourceSourceTypeEnum.optional(),
  tag: z.string().max(64).optional(),
  flag: z.enum(["featured"]).optional(),
  sort: z.enum(["newest", "az", "curated"]).optional().default("curated"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListFreeResourcesQuery = z.infer<typeof listFreeResourcesQuerySchema>;

export const aiPlatformCategoryEnum = z.enum([
  "CHAT",
  "CODING",
  "IMAGE",
  "VIDEO",
  "WRITING",
  "RESEARCH",
  "EDUCATION",
  "PRODUCTIVITY",
  "PRESENTATIONS",
  "DESIGN",
  "AUDIO",
  "OTHER",
]);

export const aiPricingTypeEnum = z.enum([
  "FREE",
  "FREE_TIER",
  "FREE_PLAN_LIMITED",
  "FREE_TRIAL",
  "OPEN_SOURCE",
]);

export const aiPlatformFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  description: z.string().trim().max(2_000).optional().default(""),
  url: externalResourceUrl,
  category: aiPlatformCategoryEnum,
  pricingType: aiPricingTypeEnum,
  /**
   * Plain text, shown verbatim next to the pricing badge. Capped short so it
   * stays a factual note ("20 messages/day") rather than marketing copy.
   */
  freeTierNote: z.string().trim().max(200).optional().default(""),
  logo: imageRef.optional().default(""),
  tags: z.string().max(500).optional().default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});
export type AiPlatformFormValues = z.infer<typeof aiPlatformFormSchema>;

export const listAiPlatformsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: aiPlatformCategoryEnum.optional(),
  pricing: aiPricingTypeEnum.optional(),
  tag: z.string().max(64).optional(),
  flag: z.enum(["featured"]).optional(),
  sort: z.enum(["newest", "az", "curated"]).optional().default("curated"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ListAiPlatformsQuery = z.infer<typeof listAiPlatformsQuerySchema>;

// --- Auth (email/password + profile) ---

const usernameSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(24, "At most 24 characters")
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Start with a letter; letters, numbers and underscore only");

export const chatDisplayNameFormSchema = z.object({
  chatDisplayName: usernameSchema,
});

/** Structural minimum only — the strength meter guides users toward stronger passwords client-side. */
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const signupFormSchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().email("Enter a valid email").max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SignupFormValues = z.infer<typeof signupFormSchema>;

export const verifySignupOtpSchema = z.object({
  email: z.string().trim().email().max(200),
  code: otpCodeSchema,
});

export const loginFormSchema = z.object({
  identifier: z.string().trim().min(1, "Required").max(200),
  password: z.string().min(1, "Required").max(200),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(200),
});

export const verifyPasswordResetOtpSchema = z.object({
  email: z.string().trim().email().max(200),
  code: otpCodeSchema,
});

export const resetPasswordFormSchema = z
  .object({
    ticket: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const displayNameFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
});

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().max(200).optional().default(""),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changeEmailRequestSchema = z.object({
  newEmail: z.string().trim().email("Enter a valid email").max(200),
  currentPassword: z.string().max(200).optional().default(""),
});

export const changeEmailVerifySchema = z.object({
  code: otpCodeSchema,
});

export const deleteAccountFormSchema = z.object({
  currentPassword: z.string().max(200).optional().default(""),
});

/** Turn a newline-separated textarea value into a clean list (prerequisites, outcomes). */
export function parseLines(input: string, maxItems = 20): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length <= 200)
    .slice(0, maxItems);
}

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

"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { codingChannelFormSchema, parseTags, fetchYoutubeMetaSchema } from "@/lib/validation";
import { deleteOrphanedUploads, deleteUpload } from "@/lib/uploads";
import { fetchYoutubeOEmbed, type YoutubeMetaFailure } from "@/lib/youtube";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
}

/** Deletes an old logo, but only if nothing else still points at it. */
async function releaseChannelLogo(oldPath: string | null, excludeId: string, keep: string | null): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keep === oldPath) return;
  const stillUsed = await db.codingChannel.count({ where: { id: { not: excludeId }, logo: oldPath } });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

export async function saveChannelAction(channelId: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = codingChannelFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const data = {
    name: v.name,
    slug: v.slug,
    url: v.url,
    logo: v.logo || null,
    shortDescription: v.shortDescription || null,
    description: v.description || null,
    tags: parseTags(v.tags),
    spokenLanguage: v.spokenLanguage.trim() || null,
    skillLevel: v.skillLevel || null,
    bestSuitedFor: v.bestSuitedFor || null,
    featured: v.featured,
    verified: v.verified,
    published: v.published,
  };

  try {
    if (channelId) {
      const id = idSchema.parse(channelId);
      const existing = await db.codingChannel.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Channel not found" };

      const channel = await db.codingChannel.update({ where: { id }, data });
      if (existing.logo !== channel.logo) {
        await releaseChannelLogo(existing.logo, channel.id, channel.logo);
      }
      await logAudit({
        userId: user.id,
        action: "codingChannel.update",
        entity: "codingChannel",
        entityId: channel.id,
        meta: { name: channel.name },
      });
      revalidateSite();
      return { ok: true, id: channel.id };
    }

    const last = await db.codingChannel.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const channel = await db.codingChannel.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
    await logAudit({
      userId: user.id,
      action: "codingChannel.create",
      entity: "codingChannel",
      entityId: channel.id,
      meta: { name: channel.name },
    });
    revalidateSite();
    return { ok: true, id: channel.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A channel with this slug already exists." };
    }
    console.error("[admin] saveChannel failed:", err);
    return { ok: false, error: "Failed to save channel." };
  }
}

export async function deleteChannelsAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.codingChannel.findMany({
    where: { id: { in: parsed.data } },
    select: { logo: true },
  });
  const { count } = await db.codingChannel.deleteMany({ where: { id: { in: parsed.data } } });

  await deleteOrphanedUploads(
    doomed.map((c) => c.logo),
    async (paths) => {
      const rows = await db.codingChannel.findMany({
        where: { logo: { in: paths } },
        select: { logo: true },
      });
      return rows.map((r) => r.logo).filter((p): p is string => Boolean(p));
    }
  );

  await logAudit({ userId: user.id, action: "codingChannel.delete", entity: "codingChannel", meta: { count } });
  revalidateSite();
  return { ok: true };
}

export async function toggleChannelPublishedAction(channelId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(channelId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.codingChannel.findUnique({ where: { id: parsed.data }, select: { published: true } });
  if (!existing) return { ok: false, error: "Channel not found" };
  await db.codingChannel.update({ where: { id: parsed.data }, data: { published: !existing.published } });
  await logAudit({ userId: user.id, action: "codingChannel.toggle_published", entity: "codingChannel", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}

export async function toggleChannelFeaturedAction(channelId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(channelId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.codingChannel.findUnique({ where: { id: parsed.data }, select: { featured: true } });
  if (!existing) return { ok: false, error: "Channel not found" };
  await db.codingChannel.update({ where: { id: parsed.data }, data: { featured: !existing.featured } });
  await logAudit({ userId: user.id, action: "codingChannel.toggle_featured", entity: "codingChannel", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}

export async function toggleChannelVerifiedAction(channelId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(channelId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.codingChannel.findUnique({ where: { id: parsed.data }, select: { verified: true } });
  if (!existing) return { ok: false, error: "Channel not found" };
  await db.codingChannel.update({ where: { id: parsed.data }, data: { verified: !existing.verified } });
  await logAudit({ userId: user.id, action: "codingChannel.toggle_verified", entity: "codingChannel", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}

/**
 * Admin-only YouTube metadata lookup, used by the "Fetch from YouTube" button in
 * the channel/resource forms. Never blocks manual entry — every failure returns
 * a message and leaves the form editable.
 */
/** Specific, truthful copy per failure mode — a single catch-all message made this undiagnosable for the admin. */
const YOUTUBE_META_ERRORS: Record<YoutubeMetaFailure, string> = {
  "invalid-url": "That doesn't look like a YouTube video or playlist link.",
  "channel-unsupported":
    "YouTube can't return details for a channel page. Paste one video from the channel instead — the channel name and URL are filled in from it.",
  "not-found": "YouTube has no public details for that link (it may be private, deleted, or restricted).",
  "upstream-error": "YouTube didn't return usable details. Try again, or fill the form manually.",
  timeout: "YouTube took too long to respond. Try again, or fill the form manually.",
  network: "Couldn't reach YouTube just now. Try again, or fill the form manually.",
};

export async function fetchYoutubeMetaAction(
  input: unknown
): Promise<
  | { ok: true; title: string; authorName: string; authorUrl: string; thumbnailUrl: string }
  | { ok: false; error: string }
> {
  const user = await requireAdmin();
  const parsed = fetchYoutubeMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };

  const rl = checkRateLimit(`youtube-oembed:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many lookups. Please slow down." };

  const result = await fetchYoutubeOEmbed(parsed.data.url);
  if (!result.ok) return { ok: false, error: YOUTUBE_META_ERRORS[result.reason] };

  return {
    ok: true,
    title: result.data.title,
    authorName: result.data.authorName,
    authorUrl: result.data.authorUrl,
    thumbnailUrl: result.data.thumbnailUrl,
  };
}

"use server";

import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

export async function toggleChannelBookmarkAction(
  channelId: unknown
): Promise<ActionResult & { bookmarked?: boolean; bookmarkCount?: number }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(channelId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const channel = await db.codingChannel.findUnique({
    where: { id: parsed.data },
    select: { id: true, published: true },
  });
  if (!channel || !channel.published) return { ok: false, error: "Channel not found." };

  const existing = await db.codingChannelBookmark.findUnique({
    where: { channelId_userId: { channelId: parsed.data, userId: user.id } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.codingChannelBookmark.delete({ where: { id: existing.id } }),
      db.codingChannel.update({ where: { id: parsed.data }, data: { bookmarkCount: { decrement: 1 } } }),
    ]);
    return { ok: true, bookmarked: false, bookmarkCount: updated.bookmarkCount };
  }

  const [, updated] = await db.$transaction([
    db.codingChannelBookmark.create({ data: { channelId: parsed.data, userId: user.id } }),
    db.codingChannel.update({ where: { id: parsed.data }, data: { bookmarkCount: { increment: 1 } } }),
  ]);
  return { ok: true, bookmarked: true, bookmarkCount: updated.bookmarkCount };
}


import "server-only";
import { db } from "@/lib/db";

/**
 * Public listing data for the two Premium sections. Selects ONLY the public
 * fields — `content`, `url` and `telegramChatId` are never read here, so they
 * cannot end up in a statically rendered page or its RSC payload.
 */

export async function listPremiumResourcesPublic() {
  const categories = await db.premiumCategory.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      icon: true,
      resources: {
        where: { published: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, summary: true, tags: true, url: true },
      },
    },
  });
  return categories.map((c) => ({
    ...c,
    resources: c.resources.map(({ url, ...r }) => ({ ...r, hasLink: Boolean(url) })),
  }));
}

export type PublicPremiumCategory = Awaited<ReturnType<typeof listPremiumResourcesPublic>>[number];

/**
 * Members' private Telegram groups only. On-site chat rooms (kind WEB_ROOM)
 * were withdrawn from the website on 2026-10-29: the site hosts no
 * user-to-user messaging. Their rows stay in the database, unreachable.
 */
export async function listPremiumChatsPublic() {
  return db.premiumChat.findMany({
    where: { published: true, kind: "TELEGRAM_GROUP" },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, description: true, category: true, kind: true },
  });
}

export type PublicPremiumChat = Awaited<ReturnType<typeof listPremiumChatsPublic>>[number];

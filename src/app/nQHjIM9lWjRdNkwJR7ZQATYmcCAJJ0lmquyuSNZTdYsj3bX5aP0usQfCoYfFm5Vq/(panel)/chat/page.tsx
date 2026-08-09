import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";
import { chatAuthorSelect, resolveChatAuthorDisplay } from "@/lib/chat";
import { ChatModerationTable, type ChatMessageRow } from "@/components/admin/chat-moderation-table";
import { ChatUsersTable, type ChatUserRow } from "@/components/admin/chat-users-table";
import { ModerationReportsTable, type ModerationReportRow } from "@/components/admin/moderation-reports-table";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const TABS = [
  { value: "messages", label: "Messages" },
  { value: "links", label: "Pending Links" },
  { value: "reports", label: "Reports" },
  { value: "users", label: "Users" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function ChatAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = (first(raw.tab) || "messages") as (typeof TABS)[number]["value"];
  const q = first(raw.q);
  const chatStatus = first(raw.chatStatus);
  const reportStatus = first(raw.reportStatus) || "OPEN";
  const uq = first(raw.uq);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Community chat messages, link approvals, reports, bans and mutes.
        </p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`${adminPath("chat")}?tab=${t.value}`}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "messages" && <MessagesTab q={q} status={chatStatus} page={page} skip={skip} />}
      {tab === "links" && <LinksTab page={page} skip={skip} />}
      {tab === "reports" && <ReportsTab status={reportStatus} page={page} skip={skip} />}
      {tab === "users" && <UsersTab q={uq} page={page} skip={skip} />}
    </div>
  );
}

async function MessagesTab({
  q,
  status,
  page,
  skip,
}: {
  q: string;
  status: string;
  page: number;
  skip: number;
}) {
  const where: Prisma.ChatMessageWhereInput = {
    ...(q ? { body: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status: status as "VISIBLE" | "HIDDEN" | "DELETED" } : {}),
  };
  const [total, messages] = await Promise.all([
    db.chatMessage.count({ where }),
    db.chatMessage.findMany({
      where,
      select: {
        id: true,
        body: true,
        imageThumbUrl: true,
        status: true,
        linkPending: true,
        createdAt: true,
        user: { select: chatAuthorSelect },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: ChatMessageRow[] = messages.map((m) => ({
    id: m.id,
    body: m.body,
    imageThumbUrl: m.imageThumbUrl,
    status: m.status,
    linkPending: m.linkPending,
    createdAt: m.createdAt.toISOString(),
    author: resolveChatAuthorDisplay(m.user),
  }));

  return (
    <ChatModerationTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} mode="all" />
  );
}

async function LinksTab({ page, skip }: { page: number; skip: number }) {
  const where: Prisma.ChatMessageWhereInput = { linkPending: true };
  const [total, messages] = await Promise.all([
    db.chatMessage.count({ where }),
    db.chatMessage.findMany({
      where,
      select: {
        id: true,
        body: true,
        imageThumbUrl: true,
        status: true,
        linkPending: true,
        createdAt: true,
        user: { select: chatAuthorSelect },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: ChatMessageRow[] = messages.map((m) => ({
    id: m.id,
    body: m.body,
    imageThumbUrl: m.imageThumbUrl,
    status: m.status,
    linkPending: m.linkPending,
    createdAt: m.createdAt.toISOString(),
    author: resolveChatAuthorDisplay(m.user),
  }));

  return (
    <ChatModerationTable
      rows={rows}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      mode="pending-links"
    />
  );
}

async function ReportsTab({ status, page, skip }: { status: string; page: number; skip: number }) {
  const where: Prisma.ReportWhereInput = {
    chatMessageId: { not: null },
    ...(status ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" } : {}),
  };
  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: {
        reporter: { select: { name: true } },
        chatMessage: { select: { body: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: ModerationReportRow[] = reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reporter: { name: r.reporter.name },
    targetKind: "chat",
    targetPreview: r.chatMessage?.body || "(image message)",
  }));

  return (
    <ModerationReportsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
  );
}

async function UsersTab({ q, page, skip }: { q: string; page: number; skip: number }) {
  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { chatDisplayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        chatDisplayName: true,
        role: true,
        chatBanned: true,
        chatMutedUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: ChatUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    chatDisplayName: u.chatDisplayName,
    role: u.role,
    chatBanned: u.chatBanned,
    chatMutedUntil: u.chatMutedUntil ? u.chatMutedUntil.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return <ChatUsersTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}

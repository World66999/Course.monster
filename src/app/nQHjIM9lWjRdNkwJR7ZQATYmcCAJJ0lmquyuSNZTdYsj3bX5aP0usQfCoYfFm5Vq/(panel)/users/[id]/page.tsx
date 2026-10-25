import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { Badge } from "@/components/ui/badge";
import { UserPremiumManager } from "@/components/admin/premium/user-premium-manager";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) notFound();
  const raw = await searchParams;
  const cq = (Array.isArray(raw.cq) ? raw.cq[0] : raw.cq)?.slice(0, 100) ?? "";

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      disabled: true,
      premiumUntil: true,
      telegramId: true,
      createdAt: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, plan: true, startAt: true, expiresAt: true, status: true, source: true, note: true },
      },
      courseGrants: {
        orderBy: { createdAt: "desc" },
        select: { course: { select: { id: true, title: true, premium: true } } },
      },
    },
  });
  if (!user) notFound();

  const courses = await db.course.findMany({
    where: cq
      ? { title: { contains: cq, mode: "insensitive" } }
      : { premium: true },
    orderBy: { title: "asc" },
    take: 50,
    select: { id: true, title: true, premium: true, published: true },
  });

  return (
    <div className="space-y-6">
      <Link href={adminPath("users")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Users
      </Link>
      <div>
        <h1 className="text-heading">{user.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {user.email}
          {user.username && <span>@{user.username}</span>}
          <Badge variant={user.role === "USER" ? "secondary" : "default"}>{user.role}</Badge>
          {user.disabled && <Badge variant="destructive">Banned</Badge>}
          {user.telegramId && <Badge variant="info">Telegram linked</Badge>}
        </p>
      </div>
      <UserPremiumManager
        user={{
          id: user.id,
          role: user.role,
          disabled: user.disabled,
          premiumUntil: user.premiumUntil && user.premiumUntil.getTime() > Date.now() ? user.premiumUntil.toISOString() : null,
        }}
        subscriptions={user.subscriptions.map((s) => ({
          ...s,
          startAt: s.startAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        }))}
        grants={user.courseGrants.map((g) => g.course)}
        courses={courses}
        courseQuery={cq}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { UsersTable, type AdminUserRow } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = first(raw.q);
  const provider = first(raw.provider);
  const status = first(raw.status);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(provider === "google" ? { accounts: { some: { provider: "google" } } } : {}),
    ...(provider === "email" ? { passwordHash: { not: null } } : {}),
    ...(provider === "both"
      ? { AND: [{ accounts: { some: { provider: "google" } } }, { passwordHash: { not: null } }] }
      : {}),
    ...(status === "verified" ? { emailVerified: { not: null } } : {}),
    ...(status === "unverified" ? { emailVerified: null } : {}),
    ...(status === "disabled" ? { disabled: true } : {}),
  };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        emailVerified: true,
        disabled: true,
        passwordHash: true,
        createdAt: true,
        accounts: { select: { provider: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    // Never expose the tombstoned placeholder email for deleted accounts.
    email: u.disabled && !u.passwordHash && u.accounts.length === 0 ? "—" : u.email,
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
    disabled: u.disabled,
    hasPassword: Boolean(u.passwordHash),
    hasGoogle: u.accounts.some((a) => a.provider === "google"),
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search accounts, view provider &amp; verification status, disable or restore.
        </p>
      </div>
      <UsersTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
    </div>
  );
}

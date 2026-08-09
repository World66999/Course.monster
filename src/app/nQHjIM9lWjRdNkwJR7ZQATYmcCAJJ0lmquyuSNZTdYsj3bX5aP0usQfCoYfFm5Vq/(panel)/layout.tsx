import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-path";
import { isStaff } from "@/lib/roles";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) redirect(ADMIN_LOGIN_PATH);

  // Sessions are stateless JWTs, so a staff account disabled after sign-in
  // still holds a technically-valid session until it expires — re-check
  // live, same as requireAdmin() does for every admin server action.
  // Redirect to the public site, not ADMIN_LOGIN_PATH: the admin login
  // page's own "already authenticated" redirect (authConfig.authorized(),
  // deliberately DB-free since it runs in edge middleware on every
  // request) only checks isStaff/isLoggedIn, not disabled — sending a
  // disabled staff session back there would just bounce them straight back
  // here, an infinite redirect loop.
  const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { disabled: true } });
  if (!dbUser || dbUser.disabled) redirect("/");

  const settings = await getSiteSettings();

  return (
    <AdminShell
      siteName={settings.siteName}
      user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }}
    >
      {children}
    </AdminShell>
  );
}

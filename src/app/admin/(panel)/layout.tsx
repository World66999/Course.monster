import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSiteSettings } from "@/lib/settings";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
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

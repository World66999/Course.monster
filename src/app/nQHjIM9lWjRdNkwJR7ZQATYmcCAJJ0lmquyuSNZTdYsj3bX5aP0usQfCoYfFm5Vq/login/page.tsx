import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const settings = await getSiteSettings();
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="absolute top-1/4 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-accent/25 to-primary/25 blur-3xl"
      />
      <div className="glass relative w-full max-w-sm rounded-feature p-8 shadow-floating inset-shadow-highlight">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-gradient-to-br from-violet to-primary text-white shadow-md shadow-primary/30 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.25)]">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">{settings.siteName} Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your platform</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

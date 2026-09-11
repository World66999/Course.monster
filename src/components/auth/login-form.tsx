"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { loginFormSchema, type LoginFormValues } from "@/lib/validation";
import { precheckLoginAction } from "@/server/actions/public-auth";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard, AuthDivider } from "@/components/auth/auth-card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) });

  React.useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Email verified — you can sign in now.");
    }
  }, [searchParams]);

  async function onSubmit(values: LoginFormValues) {
    // Friendly disabled/unverified/rate-limit messages before attempting.
    const precheck = await safeAction(() => precheckLoginAction(values), "pre-check login");
    if (!precheck.ok) {
      toast.error(precheck.error);
      return;
    }
    // Client-side signIn (not a Server Action) so the header/avatar/session
    // context updates instantly in THIS tab without a manual refresh.
    const result = await signIn("credentials", { ...values, redirect: false });
    if (result?.error) {
      toast.error("Invalid username/email or password.");
      return;
    }
    // signIn() (unlike signOut()) never broadcasts to other tabs — getSession()
    // does (default `broadcast: true`), so this is what makes sign-in sync
    // across already-open tabs/windows too.
    await getSession();
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to comment, review and manage your account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <GoogleButton />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Username or email</Label>
          <Input id="identifier" autoComplete="username" {...register("identifier")} />
          <FieldError message={errors.identifier?.message} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {/* `py-1` takes it to 24px, which is the pointer minimum WCAG 2.5.8
                asks for and this link does not get the inline-text exemption —
                it is a standalone control in a form row, not a word in a
                sentence. `tap-target` then carries it to 44px on touch, where it
                is the one link someone reaches for when the password fails. Its
                row partner is a plain <Label>, so nothing else can lose taps. */}
            <Link
              href="/forgot-password"
              className="tap-target -my-1 py-1 text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField id="password" autoComplete="current-password" {...register("password")} />
          <FieldError message={errors.password?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="h-4 w-4" aria-hidden />
          )}
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

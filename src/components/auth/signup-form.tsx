"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { signupFormSchema, type SignupFormValues } from "@/lib/validation";
import { requestSignupAction } from "@/server/actions/signup";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard, AuthDivider } from "@/components/auth/auth-card";

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupFormSchema) });

  const password = watch("password") ?? "";

  async function onSubmit(values: SignupFormValues) {
    const result = await safeAction(() => requestSignupAction(values), "request signup");
    if (result.ok) {
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join to review courses, get Premium and manage your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" {...register("username")} />
          <FieldError message={errors.username?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordField id="password" autoComplete="new-password" {...register("password")} />
          <PasswordStrengthMeter password={password} />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordField id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

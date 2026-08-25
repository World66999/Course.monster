"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordFormSchema } from "@/lib/validation";
import { resetPasswordAction } from "@/server/actions/password-reset";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { AuthCard } from "@/components/auth/auth-card";

interface FormValues {
  ticket: string;
  password: string;
  confirmPassword: string;
}

export function ResetPasswordForm({ ticket }: { ticket: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { ticket },
  });

  const password = watch("password") ?? "";

  async function onSubmit(values: FormValues) {
    const result = await safeAction(() => resetPasswordAction(values), "reset password");
    if (result.ok) {
      toast.success("Password reset — you can sign in now.");
      router.push("/login");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password you haven't used before">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register("ticket")} />
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordField id="password" autoComplete="new-password" {...register("password")} />
          <PasswordStrengthMeter password={password} />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordField id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}

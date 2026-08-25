"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { changePasswordFormSchema } from "@/lib/validation";
import { changePasswordAction } from "@/server/actions/profile";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";

type FormOutput = z.infer<typeof changePasswordFormSchema>;

export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof changePasswordFormSchema>, unknown, FormOutput>({
    resolver: zodResolver(changePasswordFormSchema),
  });

  const newPassword = watch("newPassword") ?? "";

  async function onSubmit(values: FormOutput) {
    const result = await safeAction(() => changePasswordAction(values), "change password");
    if (result.ok) {
      toast.success(hasPassword ? "Password changed" : "Password set");
      reset();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div>
        <h2 className="font-semibold">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="text-sm text-muted-foreground">
          {hasPassword
            ? "Choose a strong password you haven't used before."
            : "Add a password so you can also sign in with your email, not just Google."}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor="pw-currentPassword">Current password</Label>
            <PasswordField
              id="pw-currentPassword"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            <FieldError message={errors.currentPassword?.message} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <PasswordField id="newPassword" autoComplete="new-password" {...register("newPassword")} />
          <PasswordStrengthMeter password={newPassword} />
          <FieldError message={errors.newPassword?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordField id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </form>
    </section>
  );
}

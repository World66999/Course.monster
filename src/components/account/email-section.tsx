"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { changeEmailRequestSchema } from "@/lib/validation";
import { requestEmailChangeAction, verifyEmailChangeAction } from "@/server/actions/profile";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { OtpInput } from "@/components/auth/otp-input";

type FormOutput = z.infer<typeof changeEmailRequestSchema>;

export function EmailSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof changeEmailRequestSchema>, unknown, FormOutput>({
    resolver: zodResolver(changeEmailRequestSchema),
  });

  async function onRequest(values: FormOutput) {
    const result = await safeAction(() => requestEmailChangeAction(values), "request email change");
    if (result.ok) {
      setPendingEmail(values.newEmail);
      toast.success("Check your new inbox for a verification code.");
    } else {
      toast.error(result.error);
    }
  }

  async function onVerify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const result = await safeAction(() => verifyEmailChangeAction({ code }), "verify email change");
      if (result.ok) {
        toast.success("Email updated");
        await update({ email: pendingEmail });
        setPendingEmail(null);
        setCode("");
        router.refresh();
      } else {
        toast.error(result.error);
        setCode("");
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="space-y-4 rounded-card border border-border bg-card p-6 shadow-soft">
      <div>
        <h2 className="font-semibold">Email</h2>
        <p className="text-sm text-muted-foreground">
          Current: <span className="font-medium break-all text-foreground">{email}</span> — never shown publicly.
        </p>
      </div>

      {pendingEmail ? (
        <div className="space-y-3">
          <FieldHint>Enter the code sent to {pendingEmail} to confirm the change.</FieldHint>
          <OtpInput value={code} onChange={setCode} disabled={verifying} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPendingEmail(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={code.length !== 6 || verifying} onClick={onVerify}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Confirm
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onRequest)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">New email</Label>
            <Input id="newEmail" type="email" {...register("newEmail")} />
            <FieldError message={errors.newEmail?.message} />
          </div>
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="email-currentPassword">Current password</Label>
              <PasswordField
                id="email-currentPassword"
                autoComplete="current-password"
                {...register("currentPassword")}
              />
              <FieldError message={errors.currentPassword?.message} />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mail className="h-4 w-4" aria-hidden />
              )}
              Send verification code
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

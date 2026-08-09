"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { forgotPasswordFormSchema } from "@/lib/validation";
import { requestPasswordResetAction, verifyPasswordResetOtpAction } from "@/server/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthCard } from "@/components/auth/auth-card";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "otp">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordFormSchema) });

  async function onRequest(values: { email: string }) {
    const result = await requestPasswordResetAction(values);
    if (result.ok) {
      setEmail(values.email);
      setStep("otp");
      toast.success("If that email is registered, a code is on its way.");
    } else {
      toast.error(result.error);
    }
  }

  async function onVerify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyPasswordResetOtpAction({ email, code });
      if (result.ok && result.ticket) {
        router.push(`/reset-password?ticket=${encodeURIComponent(result.ticket)}`);
      } else {
        toast.error(!result.ok ? result.error : "Something went wrong");
        setCode("");
      }
    } finally {
      setVerifying(false);
    }
  }

  if (step === "otp") {
    return (
      <AuthCard
        title="Enter the code"
        subtitle={
          <>
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
          </>
        }
      >
        <div className="flex flex-col items-center gap-6">
          <OtpInput value={code} onChange={setCode} autoFocus disabled={verifying} />
          <Button size="lg" className="w-full" disabled={code.length !== 6 || verifying} onClick={onVerify}>
            {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Continue
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" subtitle="We'll email you a code to reset it">
      <form onSubmit={handleSubmit(onRequest)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          Send code
        </Button>
      </form>
    </AuthCard>
  );
}

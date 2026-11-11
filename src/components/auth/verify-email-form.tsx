"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { verifySignupOtpAction, resendSignupOtpAction } from "@/server/actions/signup";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";
import { AuthCard } from "@/components/auth/auth-card";

const RESEND_COOLDOWN = 60;

export function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onVerify() {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      const result = await safeAction(() => verifySignupOtpAction({ email, code }), "verify signup code");
      if (result.ok) {
        router.push("/login?verified=1");
      } else {
        toast.error(result.error);
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);
    const result = await safeAction(() => resendSignupOtpAction(email), "resend signup code");
    if (result.ok) {
      toast.success("A new code has been sent.");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
        </>
      }
    >
      <div className="flex flex-col items-center gap-6">
        <MailCheck className="h-10 w-10 text-primary" aria-hidden />
        <OtpInput value={code} onChange={setCode} autoFocus disabled={submitting} />
        <Button size="lg" className="w-full" disabled={code.length !== 6 || submitting} onClick={onVerify}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Verify email
        </Button>
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </AuthCard>
  );
}

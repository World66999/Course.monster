import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";

export class MailError extends Error {}

async function sendMail(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new MailError("Email delivery is not configured");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[mail] Resend API error:", res.status, body.slice(0, 500));
    throw new MailError("Failed to send email");
  }

  // Traceable for support/debugging — not sensitive, just Resend's message id.
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  if (data?.id) console.log(`[mail] sent to ${opts.to}, resend id ${data.id}`);
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
                <span style="color:#fff;font-size:18px;font-weight:700;">Courses Monster</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${heading}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f9fafb;color:#9ca3af;font-size:12px;">
                If you didn't request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function otpBlock(code: string): string {
  return `<div style="margin:24px 0;text-align:center;">
    <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;background:#f3f4f6;padding:16px 24px;border-radius:12px;">${code}</span>
  </div>
  <p style="margin:0;color:#6b7280;font-size:14px;">This code expires in 10 minutes and can only be used once.</p>`;
}

export async function sendSignupOtpEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: `${code} is your Courses Monster verification code`,
    html: layout(
      "Verify your email",
      `<p style="margin:0 0 8px;color:#374151;font-size:15px;">Enter this code to activate your account:</p>${otpBlock(code)}`
    ),
    text: `Your Courses Monster verification code is ${code}. It expires in 10 minutes.`,
  });
}

export async function sendPasswordResetOtpEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: `${code} is your Courses Monster password reset code`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 8px;color:#374151;font-size:15px;">Enter this code to reset your password:</p>${otpBlock(code)}`
    ),
    text: `Your Courses Monster password reset code is ${code}. It expires in 10 minutes.`,
  });
}

export async function sendEmailChangeOtpEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: `${code} is your Courses Monster email change code`,
    html: layout(
      "Confirm your new email",
      `<p style="margin:0 0 8px;color:#374151;font-size:15px;">Enter this code to confirm this is your new email address:</p>${otpBlock(code)}`
    ),
    text: `Your Courses Monster email change code is ${code}. It expires in 10 minutes.`,
  });
}

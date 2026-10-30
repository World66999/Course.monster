import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/site/section";
import { ProfileSection } from "@/components/account/profile-section";
import { PasswordSection } from "@/components/account/password-section";
import { EmailSection } from "@/components/account/email-section";
import { DangerZone } from "@/components/account/danger-zone";
import { PremiumTelegramSection } from "@/components/account/premium-telegram-section";

export const metadata: Metadata = {
  title: "Your account",
  alternates: { canonical: "/account" },
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Faccount");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      passwordHash: true,
      disabled: true,
      premiumUntil: true,
      telegramId: true,
    },
  });
  // A disabled account's JWT stays technically valid until it naturally
  // expires (sessions are stateless — see auth-helpers.ts's isDisabled()),
  // but it should never be able to reach the account page it can't
  // meaningfully act from — every mutation here is already blocked at the
  // action layer via requireUserSafe(), this closes the same gap at the
  // page level for consistency with how the admin panel layout already
  // gates every panel page on the same disabled check.
  if (!user || user.disabled) redirect("/login");

  const hasPassword = Boolean(user.passwordHash);

  return (
    <Section className="max-w-2xl py-12">
      <PageHeader
        eyebrow="Account"
        title="Your account"
        description="Manage your profile, security and account settings."
      />
      <div className="space-y-6">
        <ProfileSection name={user.name} image={user.image} />
        <PremiumTelegramSection
          premiumUntil={user.premiumUntil?.toISOString() ?? null}
          telegramLinked={Boolean(user.telegramId)}
        />
        <PasswordSection hasPassword={hasPassword} />
        <EmailSection email={user.email} hasPassword={hasPassword} />
        <DangerZone hasPassword={hasPassword} />
      </div>
    </Section>
  );
}

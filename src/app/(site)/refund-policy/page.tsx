import type { Metadata } from "next";
import { getPageMeta } from "@/lib/pages";
import { supportTelegram } from "@/lib/razorpay-config";
import { refundContent } from "@/lib/legal-content";
import { LegalPage } from "@/components/site/legal-page";

export const revalidate = 3600;

const meta = getPageMeta("refund-policy")!;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: meta.path },
};

export default function RefundPolicyPage() {
  return <LegalPage title={meta.title} content={refundContent(supportTelegram())} />;
}

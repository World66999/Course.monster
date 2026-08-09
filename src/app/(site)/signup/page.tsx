import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  alternates: { canonical: "/signup" },
  robots: { index: false },
};

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/account");

  return <SignupForm />;
}

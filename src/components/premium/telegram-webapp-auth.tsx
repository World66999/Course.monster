"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useSession } from "@/lib/session-client";

/**
 * Inside a Telegram Mini App, Telegram appends the signed launch data to the
 * URL fragment as `tgWebAppData`. When present and there is no session, it is
 * handed to the "telegram-webapp" credentials provider, which verifies the
 * HMAC on the server (src/lib/telegram/webapp-auth.ts). Nothing here is
 * trusted by itself — a forged fragment simply fails verification.
 *
 * Reading the fragment instead of loading telegram-web-app.js keeps the CSP
 * free of a third-party script for a value we only forward.
 */
export function TelegramWebAppAuth() {
  const { status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status !== "unauthenticated") return;
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const initData = new URLSearchParams(hash).get("tgWebAppData");
    if (!initData) return;
    try {
      // One attempt per launch, so a not-yet-linked account doesn't loop.
      if (sessionStorage.getItem("tgwa-tried") === initData.slice(-24)) return;
      sessionStorage.setItem("tgwa-tried", initData.slice(-24));
    } catch {
      // storage blocked: still try once for this page view
    }
    void signIn("telegram-webapp", { initData, redirect: false }).then((res) => {
      if (res?.ok && !res.error) router.refresh();
    });
  }, [status, router]);

  return null;
}

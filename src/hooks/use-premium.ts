"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

/**
 * The viewer's Premium state for client components on static pages.
 *
 * Display only. Every unlock is enforced by the server on the request that
 * returns the locked data; this hook just decides which UI to show. One
 * in-flight request is shared by every component on the page.
 */

export interface PremiumPayment {
  id: string;
  plan: "MONTHLY" | "YEARLY";
  amount: string;
  coin: string;
  status: string;
  createdAt: string;
  /** Preformatted amount (e.g. "₹1,000") for non-USD payments. */
  amountLabel?: string;
}

export interface PremiumMe {
  authenticated: boolean;
  premium: boolean;
  subscribed?: boolean;
  staff?: boolean;
  premiumUntil?: string | null;
  /** Set when the viewer had Premium and it has ended. */
  expiredAt?: string | null;
  plan?: "MONTHLY" | "YEARLY" | null;
  telegramLinked?: boolean;
  payments?: PremiumPayment[];
}

let shared: { key: string; promise: Promise<PremiumMe> } | null = null;

function load(key: string, force: boolean): Promise<PremiumMe> {
  if (!force && shared?.key === key) return shared.promise;
  const promise = fetch("/api/premium/me", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<PremiumMe>) : { authenticated: false, premium: false }))
    .catch(() => ({ authenticated: false, premium: false }));
  shared = { key, promise };
  return promise;
}

export function usePremium(): { loading: boolean; me: PremiumMe; refresh: () => void } {
  const { data: session, status } = useSession();
  const key = session?.user?.id ?? "anon";
  const [me, setMe] = React.useState<PremiumMe | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setMe({ authenticated: false, premium: false });
      return;
    }
    let live = true;
    load(key, tick > 0).then((v) => live && setMe(v));
    return () => {
      live = false;
    };
  }, [key, status, tick]);

  return {
    loading: me === null,
    me: me ?? { authenticated: false, premium: false },
    refresh: () => setTick((t) => t + 1),
  };
}

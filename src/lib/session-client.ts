"use client";

import * as React from "react";
import type { Session } from "next-auth";
import { __NEXTAUTH, getCsrfToken, getSession } from "next-auth/react";

/**
 * The signed-in session for client components: a drop-in for next-auth's
 * `useSession()` that needs no `<SessionProvider>`.
 *
 * Why not the provider: it is a React context above the whole page, and its
 * value changes when the session request returns, about a second after load.
 * React answers a context change above parts of the page it has not made
 * interactive yet by finishing all of them at once, in one long blocking
 * task. A store has no context: when the session arrives, only the handful of
 * components that read it re-render, and the rest of the page keeps becoming
 * interactive in small steps.
 *
 * Behaviour matches the provider with its default options:
 *   - one request for the session, when the first component asks for it;
 *   - `signIn()` / `signOut()` from next-auth/react refresh it (they call
 *     `__NEXTAUTH._getSession`, which is pointed at this store);
 *   - other tabs signing in or out refresh it (next-auth's BroadcastChannel);
 *   - a signed-in visitor's session is re-read when the tab becomes visible;
 *   - `update(data)` posts to the session endpoint like the provider does.
 */

type Status = "loading" | "authenticated" | "unauthenticated";

interface Snapshot {
  data: Session | null;
  status: Status;
}

export interface ClientSession extends Snapshot {
  update: (data?: unknown) => Promise<Session | null>;
}

const LOADING: Snapshot = { data: null, status: "loading" };

let snapshot: Snapshot = LOADING;
let started = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(data: Session | null) {
  // Keep the same object when nothing changed, so readers do not re-render.
  const status: Status = data ? "authenticated" : "unauthenticated";
  if (snapshot.status === status && JSON.stringify(snapshot.data) === JSON.stringify(data)) return;
  snapshot = { data, status };
  for (const listener of listeners) listener();
}

/** Re-reads the session from the server. Concurrent calls share one request. */
export function refreshSession(): Promise<void> {
  inFlight ??= getSession({ broadcast: false })
    .then(
      (data) => publish(data ?? null),
      // A failed read is "not signed in" for display purposes; the server
      // still decides everything that matters on each request.
      () => publish(snapshot.status === "loading" ? null : snapshot.data)
    )
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  // next-auth's signIn()/signOut() call this after they change the session.
  __NEXTAUTH._getSession = () => refreshSession();

  // Another tab (or getSession() in this one) announced a change.
  try {
    new BroadcastChannel("next-auth").addEventListener("message", () => void refreshSession());
  } catch {
    // No BroadcastChannel (very old browsers): this tab still works alone.
  }

  // Coming back to the tab: a signed-in session may have ended meanwhile.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && snapshot.data) void refreshSession();
  });

  void refreshSession();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => LOADING;

async function update(data?: unknown): Promise<Session | null> {
  if (snapshot.status === "loading") return null;
  if (data === undefined) {
    await refreshSession();
    return snapshot.data;
  }
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csrfToken: await getCsrfToken(), data }),
  });
  const body = res.ok ? ((await res.json().catch(() => null)) as Session | null) : null;
  const next = body && Object.keys(body).length > 0 ? body : null;
  if (next) {
    publish(next);
    try {
      // Tell other tabs, as the provider did.
      const channel = new BroadcastChannel("next-auth");
      channel.postMessage({ event: "session", data: { trigger: "getSession" } });
      channel.close();
    } catch {
      // see start()
    }
  }
  return next;
}

export function useSession(): ClientSession {
  const current = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return React.useMemo(() => ({ data: current.data, status: current.status, update }), [current]);
}

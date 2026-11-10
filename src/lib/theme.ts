"use client";

import * as React from "react";

/**
 * Theme handling without a library.
 *
 * The class on <html> is set before first paint by `themeBootScript` (inlined
 * at the top of <body> by the root layout). This hook only reads that class
 * and changes it when the visitor presses the toggle, so nothing is restyled
 * on page load. The previous library removed and re-added the class and
 * injected a "no transitions" stylesheet on every mount, which cost three
 * whole-document style recalculations per page view.
 *
 * Storage key and values ("light" | "dark" | "system") match what the library
 * wrote, so returning visitors keep their choice.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
/** Browser-chrome colours; the light/dark `--background` tokens. */
const CHROME_COLOR: Record<ResolvedTheme, string> = { light: "#f7f6fb", dark: "#0a0912" };

const listeners = new Set<() => void>();

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readChoice(fallback: ThemeChoice): ThemeChoice {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Storage blocked (private mode, some in-app browsers): use the default.
  }
  return fallback;
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (root.classList.contains("dark") !== (resolved === "dark")) {
    root.classList.toggle("dark", resolved === "dark");
  }
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", CHROME_COLOR[resolved]));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): ResolvedTheme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";
/** Server and first client render agree on "not known yet". */
const getServerSnapshot = (): ResolvedTheme | undefined => undefined;

export function useTheme(): {
  /** Undefined until mounted, so server and client markup match. */
  resolvedTheme: ResolvedTheme | undefined;
  setTheme: (choice: ThemeChoice) => void;
} {
  const resolvedTheme = React.useSyncExternalStore<ResolvedTheme | undefined>(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // Follow the OS while the choice is "system", and other tabs' changes.
  React.useEffect(() => {
    const fallback = (document.documentElement.dataset.themeDefault as ThemeChoice | undefined) ?? "dark";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readChoice(fallback) === "system") apply(systemTheme());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const choice = readChoice(fallback);
      apply(choice === "system" ? systemTheme() : choice);
    };
    media.addEventListener?.("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener?.("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = React.useCallback((choice: ThemeChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Not persisted; still applies for this page view.
    }
    apply(choice === "system" ? systemTheme() : choice);
  }, []);

  return { resolvedTheme, setTheme };
}

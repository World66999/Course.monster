"use client";

import * as React from "react";

/**
 * "Saved courses" and "Recently viewed", kept in this browser only.
 *
 * There is no account behind it and nothing is sent to the server: free
 * visitors stay anonymous. Each entry is a small snapshot of the course card
 * (enough to draw it again without a request). Clearing site data clears both
 * lists, which is the expected behaviour for a browser-local feature.
 */

export interface LibraryItem {
  slug: string;
  title: string;
  thumbnail: string | null;
  category: string | null;
  premium: boolean;
  /** ms since epoch: when it was saved / last viewed. */
  at: number;
}

const KEYS = { saved: "cm:saved:v1", recent: "cm:recent:v1" } as const;
const LIMITS = { saved: 200, recent: 12 } as const;
type ListName = keyof typeof KEYS;

const EMPTY: LibraryItem[] = [];
const cache: Record<ListName, { raw: string | null; items: LibraryItem[] }> = {
  saved: { raw: null, items: EMPTY },
  recent: { raw: null, items: EMPTY },
};
const listeners = new Set<() => void>();

function isItem(v: unknown): v is LibraryItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.slug === "string" && /^[a-z0-9-]{1,200}$/.test(o.slug) && typeof o.title === "string";
}

function read(name: ListName): LibraryItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEYS[name]);
  } catch {
    return cache[name].items;
  }
  // Same string as last time: return the same array, so React sees no change.
  if (raw === cache[name].raw) return cache[name].items;
  let items: LibraryItem[] = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        items = parsed.filter(isItem).map((i) => ({
          slug: i.slug,
          title: String(i.title).slice(0, 300),
          thumbnail: typeof i.thumbnail === "string" && i.thumbnail.startsWith("/uploads/") ? i.thumbnail : null,
          category: typeof i.category === "string" ? i.category.slice(0, 100) : null,
          premium: Boolean(i.premium),
          at: typeof i.at === "number" ? i.at : 0,
        }));
      }
    } catch {
      items = EMPTY;
    }
  }
  cache[name] = { raw, items };
  return items;
}

function write(name: ListName, items: LibraryItem[]) {
  const trimmed = items.slice(0, LIMITS[name]);
  try {
    window.localStorage.setItem(KEYS[name], JSON.stringify(trimmed));
  } catch {
    // Storage full or blocked: keep it for this page view only.
    cache[name] = { raw: cache[name].raw, items: trimmed };
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.saved || e.key === KEYS.recent || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => EMPTY;

/** The list, newest first. Empty on the server and during hydration. */
export function useLibrary(name: ListName): LibraryItem[] {
  return React.useSyncExternalStore(subscribe, () => read(name), serverSnapshot);
}

export function useIsSaved(slug: string): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => read("saved").some((i) => i.slug === slug),
    () => false
  );
}

export type LibraryInput = Omit<LibraryItem, "at">;

/** Returns true when the course is saved after the call. */
export function toggleSaved(item: LibraryInput): boolean {
  const list = read("saved");
  const exists = list.some((i) => i.slug === item.slug);
  write("saved", exists ? list.filter((i) => i.slug !== item.slug) : [{ ...item, at: Date.now() }, ...list]);
  return !exists;
}

export function removeFrom(name: ListName, slug: string) {
  write(name, read(name).filter((i) => i.slug !== slug));
}

export function clearList(name: ListName) {
  write(name, []);
}

export function pushRecent(item: LibraryInput) {
  const list = read("recent").filter((i) => i.slug !== item.slug);
  write("recent", [{ ...item, at: Date.now() }, ...list]);
}

"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/lib/theme";

/**
 * Toasts in the site's own surface, radius and type, following the active
 * theme. Bottom-centre: on a phone that is where the thumb is, and it clears
 * the notch and the browser's top chrome in every in-app browser.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme ?? "dark"}
      richColors
      closeButton
      position="bottom-center"
      offset={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      mobileOffset={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
      toastOptions={{
        style: {
          borderRadius: "var(--radius-card)",
          fontFamily: "inherit",
        },
      }}
    />
  );
}

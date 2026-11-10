"use client";

import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Not known until mounted (the server cannot see the visitor's choice).
  if (!resolvedTheme) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled />;
  }
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" aria-hidden /> : <Moon className="h-4.5 w-4.5" aria-hidden />}
    </Button>
  );
}

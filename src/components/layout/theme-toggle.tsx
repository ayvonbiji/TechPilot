"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setThemePreference } from "@/lib/actions/settings";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(next);
        try {
          sessionStorage.setItem("itec-theme-synced", next);
        } catch {}
        void setThemePreference(next);
      }}
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      title={`Theme: ${current}`}
    >
      <Icon />
    </Button>
  );
}

/** Applies the theme saved in the user's profile (keeps devices in sync). */
export function ThemeSync({ theme }: { theme: string }) {
  const { theme: current, setTheme } = useTheme();
  useEffect(() => {
    const key = "itec-theme-synced";
    try {
      if (sessionStorage.getItem(key) !== theme && current !== theme) setTheme(theme);
      sessionStorage.setItem(key, theme);
    } catch {
      if (current !== theme) setTheme(theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}

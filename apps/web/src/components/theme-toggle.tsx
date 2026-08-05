"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "the-bridge-theme";

function preferredTheme(): "light" | "dark" {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className }: { className?: string }) {
  useLayoutEffect(() => {
    applyTheme(preferredTheme());
  }, []);

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className={cn(
        "flex size-[27px] items-center justify-center rounded-[4px] border border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label="Basculer entre les thèmes clair et sombre"
      onClick={toggleTheme}
    >
      <Sun className="theme-icon-dark size-3.5" strokeWidth={1.7} />
      <Moon className="theme-icon-light size-3.5" strokeWidth={1.7} />
    </button>
  );
}

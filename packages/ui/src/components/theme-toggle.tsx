"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

export const THEME_STORAGE_KEY = "ventura-theme";

/**
 * <head> ichida birinchi chizishdan oldin ishlaydigan skript:
 * saqlangan tanlov → qurilma sozlamasi.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

export function useIsDark() {
  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // saqlab bo'lmasa (yashirin rejim, bloklangan storage) — tanlov faqat shu sahifada qoladi
  }
}

export function ThemeToggle() {
  const dark = useIsDark();

  return (
    <Button
      variant="icon"
      size="icon"
      onClick={() => apply(!dark)}
      aria-label={dark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish"}
      title={dark ? "Yorug' rejim" : "Qorong'i rejim"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

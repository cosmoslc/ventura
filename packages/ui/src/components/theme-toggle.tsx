"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "../lib/theme";
import { Button } from "./button";

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

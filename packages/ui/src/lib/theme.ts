/*
 * Tema kaliti va birinchi chizishdan oldingi skript. Alohida (client bo'lmagan) modulda: server komponent
 * "use client" moduldan qiymat import qilsa, qiymat o'rniga client havolasi keladi va skript buziladi.
 */

export const THEME_STORAGE_KEY = "ventura-theme";

export type Appearance = "light" | "dark" | "system";

/**
 * <head> ichida birinchi chizishdan oldin ishlaydigan skript: saqlangan tanlov → standart ko'rinish.
 * `system` — qurilma sozlamasi (prefers-color-scheme). Qiymat faqat shu uchtadan biri — skriptga boshqa matn tushmaydi.
 */
export function themeScript(appearance: Appearance = "system"): string {
  const fallback =
    appearance === "system" ? 'matchMedia("(prefers-color-scheme: dark)").matches' : String(appearance === "dark");
  return `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s?s==="dark":${fallback};document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
}

export const themeInitScript = themeScript("system");

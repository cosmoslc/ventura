/*
 * Sozlamalar bo'limi (ADR 0051): asosiy menyuda bitta "Sozlamalar" bandi, ichida o'z navbari. Sahifalar o'z
 * manzilida qoladi (`app/(crm)/(settings)/...` — URL o'zgarmaydi), shuning uchun ruxsatlar (`lib/access.ts`),
 * havolalar va eski xatcho'plar buzilmaydi. Bandni ko'rish — bo'lim yoqilgan va sahifa ruxsati bor bo'lsa.
 */

export type SettingsIcon =
  | "center"
  | "courses"
  | "rooms"
  | "holidays"
  | "grades"
  | "coins"
  | "payments"
  | "notifications"
  | "bot"
  | "sms"
  | "profile"
  | "security";

export interface SettingsItem {
  href: string;
  label: string;
  /** Bo'lim kaliti (manifest); null — har doim (o'z profili, bildirishnomalar) */
  feature: string | null;
  icon: SettingsIcon;
}

export interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

export const SETTINGS_NAV: SettingsGroup[] = [
  {
    title: "Markaz",
    items: [{ href: "/settings", label: "Markaz ma'lumotlari", feature: "students", icon: "center" }],
  },
  {
    title: "O'quv jarayoni",
    items: [
      { href: "/courses", label: "Kurslar", feature: "courses", icon: "courses" },
      { href: "/rooms", label: "Xonalar", feature: "groups", icon: "rooms" },
      { href: "/holidays", label: "Bayram kunlari", feature: "holidays", icon: "holidays" },
      { href: "/grading", label: "Baholash", feature: "grades", icon: "grades" },
      { href: "/coin-settings", label: "Coinlar", feature: "coins", icon: "coins" },
    ],
  },
  {
    title: "Moliya",
    items: [{ href: "/payment-settings", label: "To'lov sozlamalari", feature: "payments", icon: "payments" }],
  },
  {
    title: "Aloqa",
    items: [
      { href: "/notifications", label: "Bildirishnomalar", feature: null, icon: "notifications" },
      { href: "/telegram-bots", label: "Telegram botlar", feature: null, icon: "bot" },
      { href: "/sms/settings", label: "SMS (Eskiz)", feature: "sms", icon: "sms" },
    ],
  },
  {
    title: "Hisob",
    items: [
      { href: "/account", label: "Mening profilim", feature: null, icon: "profile" },
      { href: "/devices", label: "Xavfsizlik va qurilmalar", feature: "students", icon: "security" },
    ],
  },
];

/** Sozlamalar ichidagi barcha manzillar (asosiy menyudan olinadi, "Sozlamalar" bandi faol bo'ladi) */
export const SETTINGS_HREFS: readonly string[] = SETTINGS_NAV.flatMap((g) => g.items.map((i) => i.href));

/** Manzil sozlamalar bo'limiga tegishlimi (ichki sahifalari ham, masalan /notifications/...) */
export function isSettingsPath(pathname: string): boolean {
  return SETTINGS_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/** Ruxsat bo'yicha filtrlash: bo'sh guruhlar tushib qoladi */
export function visibleSettings(allowed: (item: SettingsItem) => boolean): SettingsGroup[] {
  return SETTINGS_NAV.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);
}

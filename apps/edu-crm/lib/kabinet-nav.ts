/*
 * O'qituvchi kabineti menyusi (ADR 0062). Kompyuterda chapda, telefonda pastda. Bandlar bosqichma-bosqich
 * qo'shiladi: guruhlar, o'quvchilar, statistika va moliya keyingi bosqichlarda.
 */

export type KabinetIcon = "home" | "groups" | "profile";

export interface KabinetItem {
  href: string;
  label: string;
  icon: KabinetIcon;
}

export const KABINET_HOME = "/kabinet";

export const KABINET_NAV: readonly KabinetItem[] = [
  { href: KABINET_HOME, label: "Bosh sahifa", icon: "home" },
  { href: "/kabinet/guruhlar", label: "Guruhlar", icon: "groups" },
  { href: "/kabinet/profil", label: "Profil", icon: "profile" },
];

/** Joriy manzilga mos band: eng uzun prefiks (bosh sahifa faqat o'zi) */
export function kabinetActive(pathname: string): string {
  let best = KABINET_HOME;
  for (const { href } of KABINET_NAV) {
    if (href === KABINET_HOME) continue;
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > best.length) best = href;
  }
  return best;
}

/*
 * O'quvchi kabineti menyusi (ADR 0063). Kompyuterda chapda, telefonda pastda.
 * Muallif / Agent: Google Gemini
 */

export type PortalIcon = "home" | "groups" | "homework" | "settings";

export interface PortalItem {
  href: string;
  label: string;
  icon: PortalIcon;
}

export const PORTAL_HOME = "/portal";

export const PORTAL_NAV: readonly PortalItem[] = [
  { href: PORTAL_HOME, label: "Bosh sahifa", icon: "home" },
  { href: "/portal/guruhlar", label: "Guruhlarim", icon: "groups" },
  { href: "/portal/uy-ishi", label: "Uy ishi", icon: "homework" },
  { href: "/portal/sozlamalar", label: "Sozlamalar", icon: "settings" },
];

/** Joriy manzilga mos band */
export function portalActive(pathname: string): string {
  let best = PORTAL_HOME;
  for (const { href } of PORTAL_NAV) {
    if (href === PORTAL_HOME) continue;
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > best.length) best = href;
  }
  return best;
}

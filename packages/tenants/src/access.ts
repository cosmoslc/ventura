import type { Feature } from "./manifest";
import type { Tenant } from "./registry";

/*
 * Bo'limlar ilova ichida (SPEC 8-bo'lim): yoqilganini tekshirish, manzil qaysi bo'limga tegishli ekanini
 * aniqlash va menyuni qurish. Mijozga xos farq faqat shu orqali — `tenant.slug` ga qarab yozilgan kod taqiqlangan.
 */

/**
 * Bo'lim shu mijozda yoqilganmi. Asinxron: hozir ro'yxat faylidan o'qiladi, keyin (SPEC 5-bosqich)
 * paneldan kesh orqali kelishi mumkin — chaqiruvchi kod o'zgarmaydi.
 */
export async function hasFeature(tenant: Pick<Tenant, "features">, key: string): Promise<boolean> {
  return tenant.features.includes(key);
}

/** Manzil `prefix` ning o'zi yoki uning ichidami (`/students` → `/students/12`, lekin `/studentsx` emas). */
function under(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Manzil qaysi bo'limga tegishli: menyu manzili (`nav.href`) yoki API yo'li (`routes`) bo'yicha.
 * Bir nechtasi mos kelsa, eng uzun prefiks yutadi. Hech biriga tegishli bo'lmasa — null (umumiy sahifa).
 */
export function featureForPath(features: Feature[], pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const f of features) {
    for (const prefix of [...f.routes, ...f.nav.map((n) => n.href)]) {
      if (under(pathname, prefix) && (!best || prefix.length > best.len)) best = { key: f.key, len: prefix.length };
    }
  }
  return best?.key ?? null;
}

export interface NavLink {
  feature: string;
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

/**
 * Menyu: faqat yoqilgan va foydalanuvchiga ko'rish ruxsati bor bo'limlar. Band `section` (yoki bo'lim `group`i)
 * bo'yicha guruhlanadi; guruhlar va bandlar manifestdagi birinchi uchrashish tartibida, bo'sh guruh ko'rsatilmaydi.
 */
export function navFor(
  features: Feature[],
  enabled: Iterable<string>,
  /** Band ko'rinadimi (bo'lim kaliti va manzili bo'yicha — masalan xodim ruxsati) */
  allowed: (featureKey: string, href: string) => boolean = () => true,
): NavGroup[] {
  const on = new Set(enabled);
  const groups: NavGroup[] = [];
  for (const f of features) {
    if (!on.has(f.key) || !f.nav.length) continue;
    for (const n of f.nav) {
      if (!allowed(f.key, n.href)) continue;
      const title = n.section ?? f.group;
      let group = groups.find((g) => g.title === title);
      if (!group) groups.push((group = { title, links: [] }));
      group.links.push({ feature: f.key, label: n.label, href: n.href });
    }
  }
  return groups;
}

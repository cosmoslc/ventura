"use server";

import { canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { pagePermissions } from "@/lib/access";
import { SEARCH_KINDS, type SearchHit, type SearchKind } from "@/lib/search";
import type { ActionResult } from "@/lib/server/action";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { globalSearch } from "@/lib/server/search";
import { getStaff } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

/*
 * Global qidiruv (E6h): faqat xodim ko'ra oladigan turlar (bo'lim yoqilgan va sahifa ruxsati bor) va tanlangan
 * filial doirasida. `crmAction` o'rniga oddiy tekshiruv: bu o'qish, bitta bo'limga bog'liq emas.
 */

/** Tur → bo'lim kaliti va uni ochadigan sahifa (lib/access.ts) */
const SOURCES: Record<SearchKind, { feature: string; page: string }> = {
  student: { feature: "students", page: "/students" },
  lead: { feature: "leads", page: "/leads" },
  group: { feature: "groups", page: "/groups" },
  teacher: { feature: "teachers", page: "/teachers" },
  staff: { feature: "teachers", page: "/staff" },
};

export async function globalSearchAction(q: unknown): Promise<ActionResult<{ hits: SearchHit[] }>> {
  if (typeof q !== "string") return { ok: false, error: uz.common.invalid };
  const tenant = await currentTenant();
  if (!tenant) return { ok: false, error: uz.common.notFound };
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return { ok: false, error: uz.common.sessionGone };

  const kinds = new Set<SearchKind>();
  for (const kind of SEARCH_KINDS) {
    const src = SOURCES[kind];
    if (canAny(staff.access, pagePermissions(src.page)) && (await hasFeature(tenant, src.feature))) kinds.add(kind);
  }
  if (!kinds.size) return { ok: true, hits: [] };
  const branch = await getBranchContext();
  return { ok: true, hits: await globalSearch(getTenantDb(tenant), { q, filter: branch.filter, kinds }) };
}

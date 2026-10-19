import "server-only";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { inScope } from "@ventura/auth/staff/policy";
import { branches } from "@ventura/db/schema/tenant";
import { hasFeature } from "@ventura/tenants";
import { getTenantDb } from "./deps";
import { secureRequest } from "./request";
import { requireStaff, requireTenant } from "./session";

/*
 * Tepadagi filial tanlovi (eski tizimdagi "Barcha filiallar / filial"): tanlov cookie'da saqlanadi va har so'rovda
 * xodimning filial cheklovi bilan qayta tekshiriladi — cookie'ni o'zgartirib boshqa filialni ko'rib bo'lmaydi.
 * Ko'p filialli rejim (`branches` bo'limi) o'chiq bo'lsa, tanlov ko'rinmaydi va hamma narsa "barcha filiallar".
 */

export const BRANCH_COOKIE = "edu.branch";

export interface BranchOption {
  id: string;
  name: string;
  color: string;
  address: string | null;
}

export interface BranchContext {
  /** Ko'p filialli rejim yoqilgan */
  enabled: boolean;
  /** Xodim ko'ra oladigan filiallar */
  options: BranchOption[];
  /** "all" yoki filial id */
  selected: string;
  /** So'rov cheklovi: null — cheklovsiz (direktor, barcha filiallar), aks holda ruxsat etilgan filiallar */
  filter: string[] | null;
}

export const getBranchContext = cache(async (): Promise<BranchContext> => {
  const tenant = await requireTenant();
  const staff = await requireStaff(undefined, "any");
  const db = getTenantDb(tenant);
  const all = await db
    .select({ id: branches.id, name: branches.name, color: branches.color, address: branches.address })
    .from(branches)
    .orderBy(asc(branches.createdAt));
  const options = all.filter((b) => inScope(staff.scope, b.id));
  const enabled = await hasFeature(tenant, "branches");
  const wanted = (await cookies()).get(BRANCH_COOKIE)?.value ?? "all";
  const selected = enabled && options.some((b) => b.id === wanted) ? wanted : "all";
  const filter = selected !== "all" ? [selected] : staff.scope === "all" ? null : options.map((b) => b.id);
  return { enabled, options, selected, filter };
});

/** Tanlovni saqlash (qiymat tekshirilgan bo'lishi kerak) */
export async function storeBranch(value: string) {
  (await cookies()).set(BRANCH_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureRequest(),
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
}

/**
 * Yangi yozuv qaysi filialga tushadi: formada tanlangan (ruxsat etilgan bo'lsa), aks holda tepada tanlangan filial,
 * filial bitta bo'lsa — o'sha. Topilmasa null (forma "Filialni tanlang" deydi).
 */
export function resolveBranch(ctx: BranchContext, requested: string | null): string | null {
  if (requested && ctx.options.some((b) => b.id === requested)) return requested;
  if (ctx.selected !== "all") return ctx.selected;
  if (ctx.options.length === 1) return ctx.options[0]!.id;
  return null;
}

/** Yozuv (filiali bilan) xodimga ochiqmi: umumiy (filialsiz) yozuv — hammaga */
export function visibleTo(ctx: BranchContext, branchId: string | null): boolean {
  if (!branchId) return true;
  return ctx.filter === null || ctx.filter.includes(branchId);
}

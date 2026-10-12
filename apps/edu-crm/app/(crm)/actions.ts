"use server";

import { getBranchContext, storeBranch } from "@/lib/server/branch";
import { getStaff } from "@/lib/server/session";

/** Tepadagi filial tanlovi: faqat xodimga ochiq filial yoki "all" saqlanadi. */
export async function selectBranchAction(value: string): Promise<{ ok: boolean }> {
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return { ok: false };
  const ctx = await getBranchContext();
  if (value !== "all" && !ctx.options.some((b) => b.id === value)) return { ok: false };
  await storeBranch(value);
  return { ok: true };
}

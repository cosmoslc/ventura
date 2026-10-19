import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type FinanceCategoryKind,
  additionalIncomes,
  expensePlans,
  expenses,
  financeCategories,
  financeCategoryBranches,
  paymentMethods,
  teachers,
  userBranches,
  users,
} from "@ventura/db/schema/tenant";
import { addDays } from "@/lib/billing";
import type { ActionCtx } from "./action";
import { uz } from "@/lib/uz";
import { todayTashkent } from "./memberships";

/*
 * Xarajatlar va qo'shimcha daromad uchun umumiy ma'lumot (ADR 0016): toifalar (bitta ro'yxat — eski tizimda uchta
 * har xil ro'yxat bor edi), pulni olgan xodim tanlovi va sana tekshiruvi.
 */

/** Eski tizimdagi standart toifalar — mijozda hali yo'q bo'lsa yaratiladi */
export const DEFAULT_CATEGORIES: Record<FinanceCategoryKind, readonly string[]> = {
  expense: [
    "Ofis xarajatlari",
    "Reklama va marketing",
    "Kommunal to'lovlar",
    "Jihozlar va texnika",
    "Kantselyariya",
    "Internet va aloqa",
    "Choy va kofe / oshxona",
    "Dasturiy ta'minot",
    "Transport va yoqilg'i",
    "Boshqa xarajatlar",
  ],
  income: ["Kitoblar", "Mock imtihon", "Sertifikat", "Zal ijarasi", "Boshqa"],
};

export interface CategoryRow {
  id: string;
  kind: FinanceCategoryKind;
  name: string;
  active: boolean;
  /** null — barcha filiallar */
  branchIds: string[] | null;
  /** Xarajat, daromad va rejalardagi yozuvlar soni (bekor qilinganlari ham) */
  usage: number;
}

async function seedCategories(db: TenantDb) {
  const have = await db
    .select({ kind: financeCategories.kind, n: count() })
    .from(financeCategories)
    .groupBy(financeCategories.kind);
  const missing = (["expense", "income"] as const).filter((k) => !have.some((h) => h.kind === k && h.n > 0));
  if (!missing.length) return;
  await db
    .insert(financeCategories)
    .values(missing.flatMap((kind) => DEFAULT_CATEGORIES[kind].map((name, i) => ({ kind, name, sortOrder: i }))))
    .onConflictDoNothing();
}

/** Ikkala turdagi toifalar (filiallari va ishlatilishi bilan); mijozda yo'q bo'lsa standartlari yaratiladi */
export async function listCategories(db: TenantDb): Promise<CategoryRow[]> {
  await seedCategories(db);
  const [rows, links, e, i, p] = await Promise.all([
    db.select().from(financeCategories).orderBy(asc(financeCategories.sortOrder), asc(financeCategories.createdAt)),
    db.select().from(financeCategoryBranches),
    db.select({ id: expenses.categoryId, n: count() }).from(expenses).groupBy(expenses.categoryId),
    db
      .select({ id: additionalIncomes.categoryId, n: count() })
      .from(additionalIncomes)
      .groupBy(additionalIncomes.categoryId),
    db.select({ id: expensePlans.categoryId, n: count() }).from(expensePlans).groupBy(expensePlans.categoryId),
  ]);
  const usage = new Map<string, number>();
  for (const r of [...e, ...i, ...p]) usage.set(r.id, (usage.get(r.id) ?? 0) + r.n);
  return rows.map((c) => {
    const branchIds = links.filter((l) => l.categoryId === c.id).map((l) => l.branchId);
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      active: c.active,
      branchIds: branchIds.length ? branchIds : null,
      usage: usage.get(c.id) ?? 0,
    };
  });
}

/** Toifa shu filialda tanlanadimi */
export const categoryInBranch = (c: Pick<CategoryRow, "branchIds">, branchId: string) =>
  !c.branchIds || c.branchIds.includes(branchId);

/* ---------- Xodim yoki o'qituvchi ---------- */

export interface PersonOption {
  /** "user:<id>" yoki "teacher:<id>" */
  value: string;
  name: string;
  kind: "user" | "teacher";
}

export type PersonRef = { userId: string | null; teacherId: string | null };

export function parsePerson(ref: string | null): PersonRef {
  if (!ref) return { userId: null, teacherId: null };
  const [kind, id] = ref.split(":") as [string, string];
  return kind === "user" ? { userId: id, teacherId: null } : { userId: null, teacherId: id };
}

export const personValue = (r: PersonRef) =>
  r.userId ? `user:${r.userId}` : r.teacherId ? `teacher:${r.teacherId}` : null;

/**
 * Tanlovdagi xodimlar (bo'shatilmagan) va o'qituvchilar. Filial cheklovi bor bo'lsa — shu filiallarga biriktirilgan
 * xodimlar va shu filial o'qituvchilari.
 */
export async function listPeople(db: TenantDb, filter: readonly string[] | null): Promise<PersonOption[]> {
  const [staff, links, tch] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(isNull(users.archivedAt), eq(users.kind, "staff")))
      .orderBy(asc(users.name)),
    filter
      ? db
          .select()
          .from(userBranches)
          .where(inArray(userBranches.branchId, [...filter]))
      : Promise.resolve(null),
    db
      .select({ id: teachers.id, name: teachers.name })
      .from(teachers)
      .where(and(isNull(teachers.archivedAt), filter ? inArray(teachers.branchId, [...filter]) : undefined))
      .orderBy(asc(teachers.name)),
  ]);
  const allowed = links ? new Set(links.map((l) => l.userId)) : null;
  return [
    ...staff
      .filter((u) => !allowed || allowed.has(u.id))
      .map((u) => ({ value: `user:${u.id}`, name: u.name, kind: "user" as const })),
    ...tch.map((t) => ({ value: `teacher:${t.id}`, name: t.name, kind: "teacher" as const })),
  ];
}

/** Tanlangan xodim yoki o'qituvchi bor va bo'shatilmagan */
export async function personExists(db: TenantDb, ref: PersonRef): Promise<boolean> {
  if (ref.userId) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, ref.userId), isNull(users.archivedAt)));
    return !!u;
  }
  if (ref.teacherId) {
    const [t] = await db
      .select({ id: teachers.id })
      .from(teachers)
      .where(and(eq(teachers.id, ref.teacherId), isNull(teachers.archivedAt)));
    return !!t;
  }
  return true;
}

/** Pul yozuvi sanasi: kelajakda emas va bir yildan eski emas (to'lovlardagidek) */
export function moneyDateError(date: string): string | null {
  const real = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== date) return uz.groups.dateInvalid;
  const today = todayTashkent();
  if (date > today) return uz.expenses.futureDate;
  if (date < addDays(today, -366)) return uz.expenses.tooOld;
  return null;
}

/* ---------- Server amallari uchun tekshiruvlar ---------- */

/** Yozuv filiali xodimga ochiqmi (tepadagi tanlovdan qat'i nazar — xodimning barcha filiallari) */
export const ownBranch = (ctx: ActionCtx, branchId: string) => ctx.branch.options.some((b) => b.id === branchId);

/** Toifa: shu turdagi, filialda tanlanadigan; yangi tanlanganda — faol */
export async function checkCategory(
  ctx: ActionCtx,
  id: string,
  kind: CategoryRow["kind"],
  branchId: string,
  changed: boolean,
): Promise<string | null> {
  const c = (await listCategories(ctx.db)).find((x) => x.id === id && x.kind === kind);
  if (!c) return uz.expenses.categoryRequired;
  if (changed && !c.active) return uz.expenses.categoryInactive;
  if (changed && !categoryInBranch(c, branchId)) return uz.expenses.categoryNotInBranch;
  return null;
}

export async function checkMethod(ctx: ActionCtx, id: string, changed: boolean): Promise<string | null> {
  const [m] = await ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
  if (!m) return uz.expenses.methodRequired;
  if (changed && !m.active) return uz.expenses.methodInactive;
  return null;
}

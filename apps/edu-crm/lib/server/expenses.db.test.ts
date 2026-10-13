import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  additionalIncomes,
  branches,
  expensePlans,
  expenses,
  financeCategories,
  financeCategoryBranches,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { listIncomes } from "@/app/(crm)/additional-income/data";
import { listExpenses, listPlans } from "@/app/(crm)/expenses/data";
import { DEFAULT_CATEGORIES, listCategories, listPeople } from "./expenses";
import { ensurePaymentMethods } from "./finance";

/*
 * Xarajatlar va qo'shimcha daromad haqiqiy PostgreSQL'da (ADR 0016): standart toifalar, filial cheklovi, reja
 * bajarilishi bazadagi xarajatlardan, bekor qilingan yozuv hisobga kirmasligi, CHECK va FK himoyasi, boshqa mijoz
 * ma'lumoti ko'rinmasligi. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_expenses_test";
const ROLE = "edu_expenses_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

async function setup(t: TenantDb) {
  const [b1] = await t.insert(branches).values({ name: "Chilonzor" }).returning();
  const [b2] = await t.insert(branches).values({ name: "Yunusobod" }).returning();
  const categories = await listCategories(t);
  const methods = await ensurePaymentMethods(t);
  const cat = (name: string) => categories.find((c) => c.name === name)!;
  return { b1: b1!, b2: b2!, cat, cash: methods[0]!, card: methods[1]! };
}

describe.skipIf(!ADMIN_URL)("xarajatlar va qo'shimcha daromad (haqiqiy PostgreSQL)", () => {
  let s: Awaited<ReturnType<typeof setup>>;

  beforeAll(async () => {
    const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
    try {
      await admin.unsafe(`drop database if exists ${DB} with (force)`);
      await admin.unsafe(`drop role if exists ${ROLE}`);
      await admin.unsafe(`create role ${ROLE} login password '${ROLE}' nosuperuser nobypassrls`);
      await admin.unsafe(`create database ${DB} owner ${ROLE}`);
    } finally {
      await admin.end();
    }
    await migrateTenantDb(appUrl());
    db = createTenantDb(appUrl(), "alfa", { max: 2 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });
    s = await setup(db);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("standart toifalar bir marta yaratiladi, ikkala turda", async () => {
    const again = await listCategories(db);
    expect(again.filter((c) => c.kind === "expense").map((c) => c.name)).toEqual([...DEFAULT_CATEGORIES.expense]);
    expect(again.filter((c) => c.kind === "income").map((c) => c.name)).toEqual([...DEFAULT_CATEGORIES.income]);
    expect(again.every((c) => c.active && c.branchIds === null && c.usage === 0)).toBe(true);
  });

  it("ro'yxat filial bo'yicha cheklanadi, bekor qilingani belgilanadi", async () => {
    const [staff] = await db.insert(users).values({ name: "Kassir", email: "kassir@exp.local" }).returning();
    const rent = s.cat("Kommunal to'lovlar");
    await db.insert(expenses).values([
      {
        branchId: s.b1.id,
        kind: "fixed",
        categoryId: rent.id,
        reason: "Svet",
        amount: 400_000,
        date: "2026-10-03",
        methodId: s.cash.id,
        userId: staff!.id,
        createdBy: staff!.id,
      },
      {
        branchId: s.b2.id,
        kind: "variable",
        categoryId: s.cat("Kantselyariya").id,
        reason: "Qog'oz",
        amount: 50_000,
        date: "2026-10-04",
        methodId: s.card.id,
      },
      {
        branchId: s.b1.id,
        kind: "variable",
        categoryId: rent.id,
        reason: "Xato kiritilgan",
        amount: 999_000,
        date: "2026-10-05",
        methodId: s.cash.id,
        voidedAt: new Date(),
        voidedBy: staff!.id,
        voidReason: "ikki marta",
      },
    ]);
    const range = { from: "2026-10-01", to: "2026-10-31" };
    const all = await listExpenses(db, null, range);
    expect(all).toHaveLength(3);
    const only1 = await listExpenses(db, [s.b1.id], range);
    expect(only1.map((r) => r.reason).sort()).toEqual(["Svet", "Xato kiritilgan"]);
    const svet = only1.find((r) => r.reason === "Svet")!;
    expect(svet).toMatchObject({
      kind: "fixed",
      branchName: "Chilonzor",
      categoryName: "Kommunal to'lovlar",
      person: `user:${staff!.id}`,
      personName: "Kassir",
      voided: null,
    });
    expect(only1.find((r) => r.reason === "Xato kiritilgan")!.voided?.reason).toBe("ikki marta");
    expect(await listExpenses(db, null, { from: "2026-11-01", to: "2026-11-30" })).toEqual([]);
    // Ishlatilgan toifa sanog'i (bekor qilingan ham)
    expect((await listCategories(db)).find((c) => c.id === rent.id)!.usage).toBe(2);
  });

  it("reja bajarilishi bazadagi xarajatlardan: filial, oy, to'lov usuli; bekor qilingan kirmaydi", async () => {
    const rent = s.cat("Kommunal to'lovlar");
    await db.insert(expensePlans).values([
      { branchId: s.b1.id, categoryId: rent.id, month: "2026-10", amount: 500_000 },
      { branchId: s.b1.id, categoryId: rent.id, month: "2026-10", amount: 300_000, methodId: s.card.id },
      { branchId: s.b2.id, categoryId: rent.id, month: "2026-10", amount: 100_000 },
    ]);
    const plans = await listPlans(db, null, "2026-10");
    const usage = plans.map((p) => [p.branchName, p.methodName, p.usage.spent, p.usage.state]);
    expect(usage).toEqual(
      expect.arrayContaining([
        ["Chilonzor", null, 400_000, "near"],
        ["Chilonzor", s.card.name, 0, "ok"],
        ["Yunusobod", null, 0, "ok"],
      ]),
    );
    expect(await listPlans(db, [s.b2.id], "2026-10")).toHaveLength(1);
    expect(await listPlans(db, null, "2026-09")).toEqual([]);
  });

  it("qo'shimcha daromad o'z toifasi bilan, filial cheklovi bilan", async () => {
    await db.insert(additionalIncomes).values([
      {
        branchId: s.b1.id,
        categoryId: s.cat("Mock imtihon").id,
        title: "IELTS mock",
        amount: 150_000,
        date: "2026-10-06",
        methodId: s.cash.id,
        payer: "Aziz",
      },
      {
        branchId: s.b2.id,
        categoryId: s.cat("Kitoblar").id,
        title: "Kitob",
        amount: 80_000,
        date: "2026-10-06",
        methodId: s.cash.id,
      },
    ]);
    const rows = await listIncomes(db, [s.b1.id], { from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toEqual([
      expect.objectContaining({ title: "IELTS mock", categoryName: "Mock imtihon", payer: "Aziz", voided: null }),
    ]);
  });

  it("baza himoyasi: summa > 0, bitta shaxs, bekor qilish to'liq, ishlatilgan toifa o'chmaydi, filial o'chmaydi", async () => {
    const rent = s.cat("Kommunal to'lovlar");
    const base = {
      branchId: s.b1.id,
      kind: "variable" as const,
      categoryId: rent.id,
      reason: "Sinov",
      date: "2026-10-07",
      methodId: s.cash.id,
    };
    await expect(db.insert(expenses).values({ ...base, amount: 0 })).rejects.toThrow();
    const [tch] = await db
      .insert(teachers)
      .values({ branchId: s.b1.id, name: "Ustoz", phone: "+998901110000" })
      .returning();
    const [u] = await db.insert(users).values({ name: "Menejer", email: "men@exp.local" }).returning();
    await expect(
      db.insert(expenses).values({ ...base, amount: 1, userId: u!.id, teacherId: tch!.id }),
    ).rejects.toThrow();
    await expect(db.insert(expenses).values({ ...base, amount: 1, voidedAt: new Date() })).rejects.toThrow();
    await expect(db.delete(financeCategories).where(eq(financeCategories.id, rent.id))).rejects.toThrow();
    await expect(db.delete(branches).where(eq(branches.id, s.b2.id))).rejects.toThrow();
    // O'qituvchi tanlangan xarajat
    await db.insert(expenses).values({ ...base, amount: 1, teacherId: tch!.id });
    const people = await listPeople(db, [s.b1.id]);
    expect(people.some((p) => p.value === `teacher:${tch!.id}`)).toBe(true);
  });

  it("toifa filiallari saqlanadi va o'qiladi", async () => {
    const [c] = await db.insert(financeCategories).values({ kind: "expense", name: "Faqat Chilonzor" }).returning();
    await db.insert(financeCategoryBranches).values({ categoryId: c!.id, branchId: s.b1.id });
    const row = (await listCategories(db)).find((x) => x.id === c!.id)!;
    expect(row.branchIds).toEqual([s.b1.id]);
    await expect(db.insert(financeCategories).values({ kind: "expense", name: "Faqat Chilonzor" })).rejects.toThrow();
  });

  it("boshqa mijoz ma'lumoti ko'rinmaydi", async () => {
    const range = { from: "2026-01-01", to: "2026-12-31" };
    expect(await listExpenses(other, null, range)).toEqual([]);
    expect(await listIncomes(other, null, range)).toEqual([]);
    expect(await listPlans(other, null, "2026-10")).toEqual([]);
    expect(await other.select().from(expensePlans)).toEqual([]);
    expect(await other.select().from(financeCategoryBranches)).toEqual([]);
    // Boshqa mijozning o'z standart toifalari — alohida
    const own = await listCategories(other);
    const mine = await listCategories(db);
    expect(own.some((c) => mine.some((m) => m.id === c.id))).toBe(false);
  });
});

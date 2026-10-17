import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, leadEvents, leads, payments, settings, students, users } from "@ventura/db/schema/tenant";
import { FUNNEL_HIDDEN_KEY } from "@/lib/lead-reports";
import { listStages } from "@/app/(crm)/leads/data";
import { ensurePaymentMethods } from "./finance";
import { REPORTS, reportPeriod } from "./reports";

/*
 * Lid hisobotlari haqiqiy PostgreSQL'da (ADR 0032): voronka bosqichlar tarixidan, yo'qotilganlar yo'qotilgan sana
 * bo'yicha, manba tushumi faqat moliyaviy ruxsat bilan, arxivdagi lid kirmaydi, boshqa mijoz ko'rmaydi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_lead_reports_test";
const ROLE = "edu_lead_reports_app";
const TODAY = "2026-10-14";
const at = (d: string) => new Date(`${d}T10:00:00+05:00`);

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

describe.skipIf(!ADMIN_URL)("lid hisobotlari (haqiqiy PostgreSQL)", () => {
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
    db = createTenantDb(appUrl(), "alfa", { max: 3 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });

    const [b] = await db.insert(branches).values({ name: "Markaz" }).returning();
    const [m] = await db.insert(users).values({ name: "Menejer", email: "m@lr.local", role: "staff" }).returning();
    const stages = await listStages(db);
    const [s0, s1] = stages.filter((s) => s.kind === "open");
    const won = stages.find((s) => s.kind === "won")!;
    const lost = stages.find((s) => s.kind === "lost")!;
    const [st] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali", phone: "+998907770001", status: "active", joinedAt: "2026-10-08" })
      .returning();
    const [cash] = await ensurePaymentMethods(db);
    await db.insert(payments).values({
      studentId: st!.id,
      kind: "payment",
      amount: 200_000,
      month: "2026-10",
      date: "2026-10-08",
      methodId: cash!.id,
      receiptNo: 1,
    });

    const add = async (v: Partial<typeof leads.$inferInsert> & { name: string; phone: string }, path: string[]) => {
      const [l] = await db
        .insert(leads)
        .values({ branchId: b!.id, stageId: path.at(-1)!, ...v })
        .returning();
      await db.insert(leadEvents).values(
        path.map((to, i) => ({
          leadId: l!.id,
          fromStageId: path[i - 1] ?? null,
          toStageId: to,
          at: at(`2026-10-0${i + 1}`),
        })),
      );
      return l!;
    };
    // Instagram: o'quvchi bo'ldi (to'lagan) va yo'qotilgan (2-bosqichdan)
    await add(
      {
        name: "Aziz",
        phone: "+998901110001",
        source: "Instagram",
        assignedTo: m!.id,
        studentId: st!.id,
        createdAt: at("2026-10-01"),
      },
      [s0!.id, s1!.id, won.id],
    );
    await add(
      {
        name: "Botir",
        phone: "+998901110002",
        source: "Instagram",
        assignedTo: m!.id,
        createdAt: at("2026-10-01"),
        stageChangedAt: at("2026-10-10"),
        lostReason: "Narxi qimmat",
        lostFromStageId: s1!.id,
      },
      [s0!.id, s1!.id, lost.id],
    );
    // Manbasiz, birinchi bosqichda
    await add({ name: "Vali", phone: "+998901110003", createdAt: at("2026-10-01") }, [s0!.id]);
    // Sentyabrda kelgan, oktyabrda sababsiz yo'qotilgan
    await add(
      {
        name: "Gani",
        phone: "+998901110004",
        source: "Telegram",
        createdAt: at("2026-09-20"),
        stageChangedAt: at("2026-10-05"),
        lostFromStageId: s0!.id,
      },
      [s0!.id, lost.id],
    );
    // Arxivdagi lid hech qayerga kirmaydi
    await add({ name: "Arxiv", phone: "+998901110005", createdAt: at("2026-10-02"), archivedAt: new Date() }, [s0!.id]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const load = (
    key: "funnel" | "lost" | "sources" | "seasonal",
    finance = true,
    d = db,
    query?: Record<string, string>,
  ) =>
    REPORTS[key].load({
      db: d,
      filter: null,
      period: reportPeriod({ yil: "2026", oy: "10" }, TODAY, REPORTS[key].periodMode),
      today: TODAY,
      finance,
      query,
    });

  it("voronka: bosqichlar tarixidan yetgan pog'ona, eng katta tushish", async () => {
    const r = await load("funnel");
    // 4 ochiq bosqich + "Guruhga qo'shildi" (won)
    expect(r.table.rows.map((x) => x.cells.count)).toEqual([3, 2, 1, 1, 1]);
    // konversiya, yakuniy bosqichga yetmagan, avvalgidan o'tmagan, eng katta tushish
    expect(r.metrics.map((m) => m.value)).toEqual([(1 / 3) * 100, 2, 0, 50]);
    expect(r.table.rows[0]!.cells.days).toBe(1);
  });

  it("voronka: manba filtri, yashirin bosqich, bosqich tanlash, mas'ul va ro'yxat", async () => {
    // Instagram: Aziz (o'quvchi bo'ldi) va Botir (2-bosqichgacha, yo'qotilgan)
    const ig = await load("funnel", true, db, { manba: "Instagram" });
    expect(ig.table.rows.map((x) => x.cells.count)).toEqual([2, 2, 1, 1, 1]);
    // "Boshqa" — manbasiz lid
    const none = await load("funnel", true, db, { manba: "Boshqa" });
    expect(none.table.rows.map((x) => x.cells.count)).toEqual([1, 0, 0, 0, 0]);

    // Tanlangan bosqich ("Ma'lumot berildi"): ro'yxatda shu yerda to'xtagan lid, yo'qotilgani belgilanadi
    const stages = await listStages(db);
    const s1 = stages.filter((s) => s.kind === "open")[1]!;
    const sel = await load("funnel", true, db, { bosqich: s1.id });
    const rows = sel.extra!.find((x) => x.title === "Lidlar ro'yxati")!.table.rows;
    expect(rows.map((x) => x.cells.lead)).toEqual(["Botir"]);
    expect(rows[0]!.cells.stage).toBe("Ma'lumot berildi · shu yerda yo'qotilgan");
    // Shu bosqichga yetmaganlar: 3 − 2
    expect(sel.metrics[1]!.value).toBe(1);

    // Mas'uli yo'q lidlar
    const unassigned = await load("funnel", true, db, { xodim: "none" });
    expect(unassigned.extra!.find((x) => x.title === "Lidlar ro'yxati")!.table.rows.map((x) => x.cells.lead)).toEqual([
      "Vali",
    ]);

    // Yashirin bosqich voronkadan chiqadi, o'tish ko'rinadigan oldingisiga nisbatan
    await db.insert(settings).values({ key: FUNNEL_HIDDEN_KEY, value: [s1.id] });
    try {
      const hidden = await load("funnel");
      expect(hidden.table.rows.map((x) => x.cells.count)).toEqual([3, 1, 1, 1]);
      expect(hidden.table.rows[1]!.cells.conv).toBeCloseTo(33.33, 1);
    } finally {
      await db.delete(settings).where(eq(settings.key, FUNNEL_HIDDEN_KEY));
    }
  });

  it("yo'qotilganlar: yo'qotilgan sana bo'yicha, sabab va bosqich", async () => {
    const r = await load("lost");
    expect(r.metrics[0]!.value).toBe(2);
    // Oktyabrda kelgan 3 tadan 1 tasi yo'qotilgan
    expect(r.metrics[1]!.value).toBeCloseTo(33.33, 1);
    expect(r.table.rows.map((x) => x.cells.reason)).toEqual(["Narxi qimmat", "Sabab ko'rsatilmagan", "Jami"]);
    const list = r.extra!.find((x) => x.title === "Yo'qotilgan lidlar ro'yxati")!.table.rows;
    expect(list.map((x) => x.cells.lead)).toEqual(["Botir", "Gani"]);
  });

  it("manbalar: holatlar va tushum faqat moliyaviy ruxsat bilan", async () => {
    const r = await load("sources");
    expect(r.table.rows[0]!.cells).toMatchObject({ source: "Instagram", leads: 2, won: 1, lost: 1, revenue: 200_000 });
    expect(r.table.rows[1]!.cells).toMatchObject({ source: "Boshqa", leads: 1, open: 1 });
    const hidden = await load("sources", false);
    expect(hidden.table.columns.some((c) => c.key === "revenue")).toBe(false);
  });

  it("mavsumiy oqim: oylar bo'yicha; boshqa mijoz hech narsa ko'rmaydi", async () => {
    const r = await load("seasonal");
    const row = (m: string) => r.table.rows.find((x) => x.cells.month === m)!.cells;
    expect(row("Sentabr")).toMatchObject({ leads: 1, won: 0 });
    expect(row("Oktabr")).toMatchObject({ leads: 3, won: 1, newStudents: 0 });
    expect(row("Dekabr").leads).toBeNull();
    expect((await load("funnel", true, other)).metrics[1]!.value).toBe(0);
    expect((await load("lost", true, other)).metrics[0]!.value).toBe(0);
  });
});

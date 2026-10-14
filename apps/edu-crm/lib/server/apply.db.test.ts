import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  auditEvents,
  branches,
  courses,
  leadEvents,
  leadNotes,
  leads,
  settings,
  users,
} from "@ventura/db/schema/tenant";
import { APPLY_FORM_KEY, APPLY_SOURCE, parseApplyForm } from "@/lib/apply-form";
import { LEAD_FIELDS_KEY } from "@/lib/form-fields";
import { applyPageData, getApplyForm, submitApplication } from "./apply";
import { prepareImport, writeImport } from "./excel-import";

/*
 * Tashqi ariza va lidlar importi haqiqiy PostgreSQL'da (ADR 0026): yangi lid birinchi ustunga "Veb-sayt forma" bilan,
 * tarix va jurnal yoziladi; shu telefonli ochiq lid bo'lsa — izoh; majburiy maydon; filial va kurs tanlovi;
 * import ochiq lid telefonini qabul qilmaydi; boshqa mijoz ko'rmaydi. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_apply_test";
const ROLE = "edu_apply_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
const ids = { a: "", b: "", courseA: "", courseB: "" };
const meta = { ip: "203.0.113.5", userAgent: "vitest" };

describe.skipIf(!ADMIN_URL)("tashqi ariza (haqiqiy PostgreSQL)", () => {
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
    db = createTenantDb(appUrl(), "alfa", { max: 4 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });
    const [a] = await db.insert(branches).values({ name: "A filial" }).returning();
    const [b] = await db.insert(branches).values({ name: "B filial" }).returning();
    const [ca] = await db.insert(courses).values({ name: "Ingliz tili", branchId: a!.id }).returning();
    const [cb] = await db.insert(courses).values({ name: "Matematika", branchId: b!.id }).returning();
    await db.insert(settings).values({
      key: LEAD_FIELDS_KEY,
      value: [
        { id: "age", label: "Yoshi", type: "number", placeholder: "", required: true, options: [] },
        { id: "inner", label: "Ichki izoh", type: "text", placeholder: "", required: true, options: [] },
      ],
    });
    Object.assign(ids, { a: a!.id, b: b!.id, courseA: ca!.id, courseB: cb!.id });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("sozlama saqlanmagan bo'lsa — o'chirilgan", async () => {
    expect((await getApplyForm(db)).enabled).toBe(false);
  });

  it("sahifada faqat tanlangan maydonlar va faol filiallar", async () => {
    const form = parseApplyForm({ enabled: true, fieldIds: ["age"] });
    const page = await applyPageData(db, form);
    expect(page.fields.map((f) => f.id)).toEqual(["age"]);
    expect(page.branches.map((b) => b.name)).toEqual(["A filial", "B filial"]);
    expect(page.courses).toHaveLength(2);
  });

  it("yangi lid: birinchi ustun, manba, tarix va jurnal; tanlanmagan maydon yozilmaydi", async () => {
    const form = parseApplyForm({ enabled: true, fieldIds: ["age"] });
    const res = await submitApplication(
      db,
      form,
      {
        name: "Aziz",
        phone: "901112233",
        branchId: null,
        courseId: ids.courseA,
        customData: { age: "15", inner: "kirmasin" },
      },
      meta,
    );
    expect(res).toMatchObject({ ok: true, repeat: false });
    if (!res.ok) return;
    const [l] = await db.select().from(leads).where(eq(leads.id, res.leadId));
    expect(l).toMatchObject({
      branchId: ids.a,
      phone: "+998901112233",
      source: APPLY_SOURCE,
      courseId: ids.courseA,
      createdBy: null,
      customData: { age: "15" },
    });
    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, res.leadId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStageId: null, actorId: null, actorName: APPLY_SOURCE });
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.action, "lead.apply"));
    expect(audit[0]).toMatchObject({ actorType: "system", actorName: APPLY_SOURCE, targetId: res.leadId });
  });

  it("shu telefonli ochiq lid bo'lsa — yangi lid emas, izoh", async () => {
    const form = parseApplyForm({ enabled: true, fieldIds: ["age"] });
    const before = await db.select({ id: leads.id }).from(leads);
    const res = await submitApplication(
      db,
      form,
      { name: "Aziz qayta", phone: "901112233", branchId: null, courseId: null, customData: { age: "16" } },
      meta,
    );
    expect(res).toMatchObject({ ok: true, repeat: true });
    expect(await db.select({ id: leads.id }).from(leads)).toHaveLength(before.length);
    const notes = await db.select().from(leadNotes);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.authorName).toBe(APPLY_SOURCE);
    expect(notes[0]!.text).toContain("Aziz qayta");
    expect(notes[0]!.text).toContain("Yoshi: 16");
  });

  it("majburiy maydon to'ldirilmasa — rad", async () => {
    const form = parseApplyForm({ enabled: true, fieldIds: ["age"] });
    const res = await submitApplication(
      db,
      form,
      { name: "Vali", phone: "931112233", branchId: null, courseId: null, customData: {} },
      meta,
    );
    expect(res).toEqual({ ok: false, reason: "missing", field: "Yoshi" });
  });

  it("filialni ariza beruvchi tanlasa — o'sha filial; boshqa filial kursi qo'shilmaydi", async () => {
    const asks = parseApplyForm({ enabled: true, askBranch: true, branchId: ids.a });
    const res = await submitApplication(
      db,
      asks,
      { name: "Lola", phone: "941112233", branchId: ids.b, courseId: ids.courseA, customData: {} },
      meta,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [l] = await db.select().from(leads).where(eq(leads.id, res.leadId));
    expect(l).toMatchObject({ branchId: ids.b, courseId: null });

    // Filial so'ralmasa, yuborilgan filial e'tiborga olinmaydi — sozlamadagisi
    const fixed = parseApplyForm({ enabled: true, askBranch: false, branchId: ids.b });
    const res2 = await submitApplication(
      db,
      fixed,
      { name: "Olim", phone: "951112233", branchId: ids.a, courseId: ids.courseB, customData: {} },
      meta,
    );
    if (!res2.ok) throw new Error("rad etildi");
    const [l2] = await db.select().from(leads).where(eq(leads.id, res2.leadId));
    expect(l2).toMatchObject({ branchId: ids.b, courseId: ids.courseB });
  });

  it("boshqa mijoz arizalarni ko'rmaydi", async () => {
    expect(await other.select().from(leads)).toHaveLength(0);
    expect(await other.select().from(settings).where(eq(settings.key, APPLY_FORM_KEY))).toHaveLength(0);
  });

  it("import: ochiq lid telefoni va fayldagi takror rad, qolganlari birinchi ustunga tarix bilan", async () => {
    const rows: Record<string, string>[] = [
      { name: "Aziz", phone: "+998 90 111 22 33" },
      { name: "Yangi", phone: "+998 97 111 22 33", gender: "Ayol", course: "ingliz tili", targetDate: "20.10.2026" },
      { name: "Takror", phone: "971112233" },
      { name: "Boshqa kurs", phone: "991112233", course: "Matematika" },
    ];
    const results = await prepareImport("leads", { db, branchId: ids.a }, rows);
    expect(results.map((r) => r.error)).toEqual([
      "Bu raqam bilan ochiq lid bor",
      null,
      "Fayl ichida takrorlangan",
      "Kurs topilmadi: Matematika",
    ]);
    const valid = results.flatMap((r) => (r.prepared ? [r.prepared] : []));
    const [userRow] = await db
      .insert(users)
      .values({ name: "Admin", email: "a@apply.local", role: "director" })
      .returning({ id: users.id });
    const created = await writeImport(db, valid, userRow!.id, "Admin");
    expect(created).toHaveLength(1);
    const [l] = await db.select().from(leads).where(eq(leads.id, created[0]!.id));
    expect(l).toMatchObject({
      gender: "female",
      courseId: ids.courseA,
      targetDate: "2026-10-20",
      createdBy: userRow!.id,
    });
    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, l!.id));
    expect(events[0]).toMatchObject({ actorId: userRow!.id, actorName: "Admin" });
  });
});

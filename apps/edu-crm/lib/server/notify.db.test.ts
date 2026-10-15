import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, notifications, positions, userBranches, userPositions, users } from "@ventura/db/schema/tenant";
import { parseApplyForm } from "@/lib/apply-form";
import { applyDraft, approvalRequestDraft } from "@/lib/notifications";
import { listNotifications, markAllRead, markRead, unreadCount } from "@/app/(crm)/notifications/data";
import { submitApplication } from "./apply";
import { directorIds, notify, staffWithPermission } from "./notify";
import { globalSearch } from "./search";

/*
 * Bildirishnomalar va global qidiruv haqiqiy PostgreSQL'da (ADR 0039): qabul qiluvchilar ruxsat va filial bo'yicha
 * aniqlanadi (direktor — hamma, arxivdagi xodim — hech qachon), takror va o'zi qilgan amal olib tashlanadi, o'qish
 * faqat o'z qatorlari, boshqa mijoz ko'rmaydi va CHECK/FK himoyasi; saytdan ariza filial xodimlariga bildirishnoma
 * yozadi; qidiruv filial doirasi va arxivni hurmat qiladi. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_notify_test";
const ROLE = "edu_notify_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
let phoneSeq = 0;
const ids = {
  a: "",
  b: "",
  director: "",
  mgrA: "",
  mgrB: "",
  accountant: "",
  gone: "",
};

describe.skipIf(!ADMIN_URL)("bildirishnomalar va qidiruv (haqiqiy PostgreSQL)", () => {
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
    const mk = async (name: string, role: "director" | "staff", archived = false) => {
      const [u] = await db
        .insert(users)
        .values({
          name,
          email: `${name}@notify.local`,
          role,
          phoneNumber: `+998905550${String(++phoneSeq).padStart(3, "0")}`,
          archivedAt: archived ? new Date() : null,
        })
        .returning();
      return u!.id;
    };
    const director = await mk("Direktor", "director");
    const mgrA = await mk("Menejer A", "staff");
    const mgrB = await mk("Menejer B", "staff");
    const accountant = await mk("Buxgalter", "staff");
    const gone = await mk("Bo'shatilgan", "staff", true);

    const [leadsPos] = await db
      .insert(positions)
      .values({ name: "Lid menejeri", permissions: ["leads.view", "leads.create"] })
      .returning();
    const [moneyPos] = await db
      .insert(positions)
      .values({ name: "Hisobchi", permissions: ["finance.payment_view"] })
      .returning();
    await db.insert(userPositions).values([
      { userId: mgrA, positionId: leadsPos!.id },
      { userId: mgrB, positionId: leadsPos!.id },
      { userId: gone, positionId: leadsPos!.id },
      { userId: accountant, positionId: moneyPos!.id },
    ]);
    await db.insert(userBranches).values([
      { userId: mgrA, branchId: a!.id },
      { userId: mgrB, branchId: b!.id },
      { userId: accountant, branchId: a!.id },
      { userId: gone, branchId: a!.id },
    ]);
    Object.assign(ids, { a: a!.id, b: b!.id, director, mgrA, mgrB, accountant, gone });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("qabul qiluvchilar: ruxsat + filial; direktor har doim, arxivdagi hech qachon", async () => {
    const inA = await staffWithPermission(db, ["leads.view"], ids.a);
    expect(new Set(inA)).toEqual(new Set([ids.director, ids.mgrA]));
    const inB = await staffWithPermission(db, ["leads.view"], ids.b);
    expect(new Set(inB)).toEqual(new Set([ids.director, ids.mgrB]));
    // Filial cheklovi yo'q — ruxsati borlarning hammasi
    const any = await staffWithPermission(db, ["leads.view"], null);
    expect(new Set(any)).toEqual(new Set([ids.director, ids.mgrA, ids.mgrB]));
    // Boshqa ruxsat — boshqa odam; ruxsatlardan birortasi yetadi
    expect(new Set(await staffWithPermission(db, ["finance.payment_view"], ids.a))).toEqual(
      new Set([ids.director, ids.accountant]),
    );
    expect(new Set(await staffWithPermission(db, ["finance.payment_view", "leads.create"], ids.a))).toEqual(
      new Set([ids.director, ids.accountant, ids.mgrA]),
    );
    expect(await directorIds(db)).toEqual([ids.director]);
  });

  it("notify: takror va o'zi qilgan amal olib tashlanadi; xato asosiy amalni to'xtatmaydi", async () => {
    const draft = approvalRequestDraft("Menejer A", "To'lov qabul qilish");
    const n = await notify(db, [ids.director, ids.director, ids.mgrA], draft, ids.mgrA);
    expect(n).toBe(1);
    expect(await notify(db, [], draft)).toBe(0);
    const [row] = await db.select().from(notifications).where(eq(notifications.userId, ids.director));
    expect(row).toMatchObject({ kind: "approval_request", href: "/approvals", readAt: null });
    expect(row!.tenantId).toBe("alfa");
    // Bo'sh sarlavha CHECK'ga tushadi — notify 0 qaytaradi, xato tashlamaydi
    expect(await notify(db, [ids.mgrA], { kind: "lead_apply", title: "" })).toBe(0);
  });

  it("CHECK: tashqi manzil va uzun matn yozilmaydi", async () => {
    const bad = (v: Partial<typeof notifications.$inferInsert>) =>
      db.insert(notifications).values({ userId: ids.mgrA, kind: "lead_apply", title: "x", ...v });
    await expect(bad({ href: "https://evil.example" })).rejects.toThrow();
    await expect(bad({ body: "x".repeat(501) })).rejects.toThrow();
    await expect(bad({ title: "x".repeat(201) })).rejects.toThrow();
  });

  it("o'qish faqat o'zinikini ko'rsatadi; boshqaning bildirishnomasi o'qilgan bo'lmaydi", async () => {
    await notify(
      db,
      [ids.mgrB],
      applyDraft({ id: "00000000-0000-0000-0000-000000000001", name: "Ali", phone: "+998 90 111 22 33" }, false),
    );
    await notify(
      db,
      [ids.mgrB],
      applyDraft({ id: "00000000-0000-0000-0000-000000000002", name: "Vali", phone: "+998 90 111 22 34" }, true),
    );
    expect(await unreadCount(db, ids.mgrB)).toBe(2);
    const mine = await listNotifications(db, ids.mgrB, { limit: 10 });
    expect(mine).toHaveLength(2);
    expect(mine.every((m) => !m.read)).toBe(true);
    // Eng yangisi birinchi
    expect(mine[0]!.createdAt >= mine[1]!.createdAt).toBe(true);
    expect((await listNotifications(db, ids.mgrB, { limit: 1 })).length).toBe(1);

    // mgrA mgrB ning bildirishnomasini o'qilgan qila olmaydi
    expect(await markRead(db, ids.mgrA, [mine[0]!.id])).toBe(0);
    expect(await unreadCount(db, ids.mgrB)).toBe(2);
    expect(await markRead(db, ids.mgrB, [mine[0]!.id])).toBe(1);
    expect(await markRead(db, ids.mgrB, [mine[0]!.id])).toBe(0);
    expect(await unreadCount(db, ids.mgrB)).toBe(1);
    expect((await listNotifications(db, ids.mgrB, { limit: 10, unreadOnly: true })).map((m) => m.id)).toEqual([
      mine[1]!.id,
    ]);
    expect(await markAllRead(db, ids.mgrA)).toBe(0);
    expect(await markAllRead(db, ids.mgrB)).toBe(1);
    expect(await unreadCount(db, ids.mgrB)).toBe(0);
  });

  it("saytdan ariza: filial xodimlari va direktorga bildirishnoma; qayta ariza mas'ulga", async () => {
    const form = parseApplyForm({ enabled: true, fieldIds: [], askBranch: true });
    const meta = { ip: "203.0.113.5", userAgent: "vitest" };
    const before = await unreadCount(db, ids.mgrA);
    const r = await submitApplication(
      db,
      form,
      { name: "Sardor Ariza", phone: "901234567", branchId: ids.a, courseId: null, customData: {} },
      meta,
    );
    expect(r.ok && !r.repeat).toBe(true);
    if (!r.ok) return;
    expect(await unreadCount(db, ids.mgrA)).toBe(before + 1);
    const [mine] = await listNotifications(db, ids.mgrA, { limit: 1 });
    expect(mine).toMatchObject({ kind: "lead_apply", href: `/leads/${r.leadId}` });
    expect(mine!.body).toContain("Sardor Ariza");
    // Boshqa filial xodimi va buxgalter (ruxsati yo'q) olmaydi
    expect(await unreadCount(db, ids.accountant)).toBe(0);
    const bNew = (await listNotifications(db, ids.mgrB, { limit: 10 })).filter((m) => m.href === `/leads/${r.leadId}`);
    expect(bNew).toEqual([]);
    expect(
      (await listNotifications(db, ids.director, { limit: 10 })).some((m) => m.href === `/leads/${r.leadId}`),
    ).toBe(true);
    // Arxivdagi xodim olmaydi
    expect(await unreadCount(db, ids.gone)).toBe(0);

    const again = await submitApplication(
      db,
      form,
      { name: "Sardor Ariza", phone: "901234567", branchId: ids.a, courseId: null, customData: {} },
      meta,
    );
    expect(again.ok && again.repeat).toBe(true);
    expect(await unreadCount(db, ids.mgrA)).toBe(before + 2);
  });

  it("boshqa mijoz ko'rmaydi va yoza olmaydi (RLS + FK)", async () => {
    expect(await other.select().from(notifications)).toEqual([]);
    expect(await unreadCount(other, ids.director)).toBe(0);
    expect(await markAllRead(other, ids.director)).toBe(0);
    // Boshqa mijoz nomidan yozib bo'lmaydi
    await expect(
      other.insert(notifications).values({ tenantId: "alfa", userId: ids.director, kind: "lead_apply", title: "x" }),
    ).rejects.toThrow();
    // Boshqa mijozning xodimiga bildirishnoma yozib bo'lmaydi (FK mijoz bo'yicha)
    expect(await notify(other, [ids.director], { kind: "lead_apply", title: "x" })).toBe(0);
  });

  it("qidiruv: ism va telefon, filial doirasi, arxiv chiqmaydi", async () => {
    const { students, teachers, leads, leadStages } = await import("@ventura/db/schema/tenant");
    await db.insert(students).values([
      { branchId: ids.a, name: "Qidiruv Alisher", phone: "+998907770001" },
      { branchId: ids.b, name: "Qidiruv Bahrom", phone: "+998907770002" },
      { branchId: ids.a, name: "Qidiruv Arxiv", phone: "+998907770003", archivedAt: new Date() },
    ]);
    await db.insert(teachers).values({ branchId: ids.a, name: "Qidiruv Ustoz", phone: "+998907770004" });
    const [stage] = await db.insert(leadStages).values({ name: "Yangi", position: 0 }).returning();
    await db.insert(leads).values({ branchId: ids.b, name: "Qidiruv Lid", phone: "+998907770005", stageId: stage!.id });
    const all = new Set(["student", "lead", "group", "teacher", "staff"] as const);

    const names = async (q: string, filter: string[] | null, kinds = all) =>
      (await globalSearch(db, { q, filter, kinds })).map((h) => h.title).sort();
    // Cheklovsiz: arxivdan tashqari hammasi
    expect(await names("Qidiruv", null)).toEqual(["Qidiruv Alisher", "Qidiruv Bahrom", "Qidiruv Lid", "Qidiruv Ustoz"]);
    // Faqat A filiali
    expect(await names("Qidiruv", [ids.a])).toEqual(["Qidiruv Alisher", "Qidiruv Ustoz"]);
    // Bo'sh doira (filialsiz xodim) — hech narsa
    expect(await names("Qidiruv", [])).toEqual([]);
    // Telefon bo'yicha (formatlangan kiritish ham)
    expect(await names("90 777 0001", null)).toEqual(["Qidiruv Alisher"]);
    expect(await names("+998 90 777 0005", null)).toEqual(["Qidiruv Lid"]);
    // Ruxsat etilmagan turlar qidirilmaydi
    expect(await names("Qidiruv", null, new Set(["student"] as const))).toEqual(["Qidiruv Alisher", "Qidiruv Bahrom"]);
    // Xodimlar: filial bo'yicha
    expect(await names("Menejer", [ids.a], new Set(["staff"] as const))).toEqual(["Menejer A"]);
    expect(await names("Menejer", null, new Set(["staff"] as const))).toEqual(["Menejer A", "Menejer B"]);
    // Maxsus belgilar oddiy belgi: "%" hammasini topmaydi
    expect(await names("%%", null)).toEqual([]);
    // Bitta turdan ko'pi bilan 5 ta
    await db
      .insert(students)
      .values(Array.from({ length: 8 }, (_, i) => ({ branchId: ids.a, name: `Ko'p ${i}`, phone: `+99890888000${i}` })));
    expect((await globalSearch(db, { q: "Ko'p", filter: null, kinds: all })).length).toBe(5);
    // Boshqa mijoz natija ko'rmaydi
    expect(await globalSearch(other, { q: "Qidiruv", filter: null, kinds: all })).toEqual([]);
  });
});

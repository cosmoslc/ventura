import { randomUUID } from "node:crypto";
import { asc, eq, isNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  additionalIncomes,
  attendance,
  branches,
  courses,
  expensePlans,
  expenses,
  financeCategories,
  financePlans,
  groupMemberships,
  groupPrices,
  groups,
  leadEvents,
  leadFirstLessons,
  leadStages,
  leads,
  membershipPauses,
  paymentMethods,
  payments,
  rooms,
  salaryEntries,
  settings,
  studentDiscounts,
  studentNotes,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { done, fail } from "./lib";
import { flag, readSecrets, secretsFile, tenantContext } from "./edu-lib";

/*
 * pnpm edu:seed-reports -- --tenant sinov
 *
 * Faqat mahalliy sinov uchun: hisobotlar (/reports) to'la ko'rinishi uchun ~18 oylik tarix — guruhlar, o'quvchilar,
 * a'zolik, davomat, to'lov, xarajat, maosh, reja va lidlar. Faqat QO'SHADI (mavjud qatorga tegmaydi), bitta
 * tranzaksiyada, takrorlanadigan tasodif bilan. Ikkinchi marta ishga tushmaydi (settings: dev.seed_reports).
 */

const slug = flag("tenant") ?? "";
const { tenant, db } = tenantContext(slug);
const MARKER = "dev.seed_reports";

// Faqat mahalliy baza: manzil chiqarilmaydi
const dbHost = new URL(readSecrets(secretsFile()).tenants[slug]!.databaseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost))
  fail(`${tenant.name}: faqat mahalliy bazaga yoziladi`);

/* ---------- Tasodif (har safar bir xil) ---------- */

let seedState = 20261014;
const rand = () => {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const chance = (p: number) => rand() < p;
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const weighted = <T>(list: readonly (readonly [T, number])[]): T => {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [v, w] of list) if ((x -= w) < 0) return v;
  return list[list.length - 1]![0];
};
const round = (v: number, step: number) => Math.round(v / step) * step;
const between = (a: number, b: number) => a + rand() * (b - a);

/* ---------- Sana yordamchilari ("YYYY-MM-DD", Toshkent) ---------- */

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y!, m! - 1, dd!);
};
const addDays = (d: string, n: number) => new Date(utc(d) + n * DAY).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const weekday = (d: string) => WEEKDAYS[new Date(utc(d)).getUTCDay()]!;
const eachDay = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
};
const monthEnd = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);
const ts = (d: string, h = 12, m = 0) => new Date(`${d}T${pad(h)}:${pad(m)}:00+05:00`);
const tashkentDate = (at: Date) => new Date(at.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);

const NOW = new Date();
const TODAY = tashkentDate(NOW);
const YESTERDAY = addDays(TODAY, -1);
const CUR_MONTH = TODAY.slice(0, 7);
const START = "2025-04-01";
const stamp = (at: Date) => ({ createdAt: at, updatedAt: at });
const past = (d: string, h = 12, m = 0) => {
  const at = ts(d, h, m);
  return at > NOW ? NOW : at;
};

/* ---------- Matn ma'lumotlari (o'zbek lotin) ---------- */

const MALE = [
  "Aziz",
  "Bekzod",
  "Doniyor",
  "Jasur",
  "Sardor",
  "Otabek",
  "Sherzod",
  "Javohir",
  "Akmal",
  "Ulug'bek",
  "Mirzo",
  "Jahongir",
  "Abbos",
  "Shohruh",
  "Islom",
  "Behruz",
  "Nodir",
  "Rustam",
  "Davron",
  "Farrux",
  "Husan",
  "Timur",
  "Zafar",
  "Eldor",
  "Anvar",
  "Sanjar",
  "Muhammad",
  "Bobur",
  "Asadbek",
  "Diyor",
];
const FEMALE = [
  "Dilnoza",
  "Madina",
  "Nilufar",
  "Sevara",
  "Malika",
  "Kamola",
  "Gulnoza",
  "Shahnoza",
  "Zarina",
  "Mohira",
  "Aziza",
  "Barno",
  "Feruza",
  "Hilola",
  "Iroda",
  "Lola",
  "Nargiza",
  "Ozoda",
  "Robiya",
  "Sabina",
  "Umida",
  "Yulduz",
  "Zilola",
  "Dildora",
  "Maftuna",
  "Sarvinoz",
  "Munisa",
  "Gulchehra",
];
const SURNAMES = [
  "Karimov",
  "Rahimov",
  "Tursunov",
  "Aliyev",
  "Yusupov",
  "Ergashev",
  "Nazarov",
  "Saidov",
  "Qodirov",
  "Abdullayev",
  "Hamidov",
  "Ismoilov",
  "Mirzayev",
  "Normatov",
  "Sobirov",
  "Umarov",
  "Xolmatov",
  "Zokirov",
  "Olimov",
  "Baxtiyorov",
];
const personName = (male: boolean) => {
  const s = pick(SURNAMES);
  return `${pick(male ? MALE : FEMALE)} ${male ? s : `${s}a`}`;
};
const DISTRICTS = [
  "Chilonzor",
  "Yunusobod",
  "Mirzo Ulug'bek",
  "Sergeli",
  "Yakkasaroy",
  "Olmazor",
  "Shayxontohur",
  "Xojaobod",
];
const COLORS = ["#6366f1", "#16a34a", "#e11d48", "#0284c7", "#d97706", "#7c3aed", "#0d9488", "#db2777"];

const LEAVE_REASONS = [
  ["Narxi qimmat", 22],
  ["Vaqti to'g'ri kelmadi", 20],
  ["O'qituvchi yoqmadi", 6],
  ["Natija bo'lmadi", 8],
  ["Boshqa markazga o'tdi", 12],
  ["Ko'chib ketdi", 6],
  ["Moliyaviy qiyinchilik", 10],
  ["Sog'lig'i sababli", 4],
  ["Kursni tugatdi", 8],
  ["Boshqa", 4],
] as const;
const LEAVE_NOTES: Record<string, string[]> = {
  "Narxi qimmat": ["Narxni pasaytirishni so'radi", "Byudjeti yetmayapti", "Boshqa markazda arzonroq ekan"],
  "Vaqti to'g'ri kelmadi": [
    "Maktab jadvaliga to'g'ri kelmadi",
    "Dars vaqti ish vaqtiga to'g'ri kelmadi",
    "Kechroq guruh so'radi",
  ],
  "O'qituvchi yoqmadi": ["Dars uslubi yoqmadi", "Boshqa o'qituvchi so'radi"],
  "Natija bo'lmadi": ["Natijadan qoniqmadi", "Darajasi o'zgarmadi, deydi"],
  "Boshqa markazga o'tdi": ["IELTS uchun boshqa markazga o'tdi", "Do'sti bilan boshqa markazga ketdi"],
  "Ko'chib ketdi": ["Oilasi Samarqandga ko'chdi", "Boshqa tumanga ko'chib ketdi"],
  "Moliyaviy qiyinchilik": ["Ota-onasi ishsiz qoldi", "Keyinroq qaytishi mumkin"],
  "Sog'lig'i sababli": ["Uzoq davolanishda", "Shifokor tavsiyasi bilan"],
  "Kursni tugatdi": ["Kurs yakunlandi", "Sertifikat oldi"],
  Boshqa: ["Sababini aytmadi", "Telefonga javob bermayapti"],
  "Guruh yopildi": ["Guruh yopildi, yangi guruhga o'tishi mumkin", "Kurs davri tugadi"],
};
const LOST_REASONS = [
  ["Narxi qimmat", 25],
  ["Vaqti to'g'ri kelmadi", 18],
  ["Boshqa markazni tanladi", 14],
  ["Javob bermadi", 20],
  ["Qiziqishi yo'qoldi", 12],
  ["Manzil uzoq", 6],
  ["Boshqa", 5],
] as const;
const LOST_NOTES = [
  "Narxni eshitib, o'ylab ko'raman dedi",
  "Telefonga javob bermadi, 3 marta qo'ng'iroq qilindi",
  "Boshqa markazga yozilgan",
  "Ota-onasi rozi bo'lmadi",
  "Jadval to'g'ri kelmadi",
  "Manzil uzoq ekan",
];
const LEAD_NOTES = [
  "Ota-onasi bilan gaplashildi",
  "Narxini so'radi",
  "Sinov darsiga kelmoqchi",
  "Do'sti ham yozilmoqchi",
  "Kechqurun qo'ng'iroq qiling",
];
const ABSENCE_REASONS = [
  "Kasal bo'ldi",
  "Oilaviy sabab",
  "Imtihonga tayyorgarlik",
  "Safarda edi",
  "Maktabda tadbir bor edi",
];
const CALL_NOTES = [
  "Qo'ng'iroq qilindi, sababini so'raldi",
  "Ota-onasi bilan gaplashildi, ertaga keladi",
  "Kasal ekan, keyingi darsda keladi",
  "Telefonni ko'tarmadi, qayta qo'ng'iroq qilinadi",
];
const OTHER_NOTES: [string, string][] = [
  ["parent", "Ota-onaga davomat haqida xabar berildi"],
  ["message", "Telegramdan dars jadvali yuborildi"],
  ["note", "Uyga vazifani o'z vaqtida topshiryapti"],
  ["result", "Oraliq testdan yaxshi natija ko'rsatdi"],
  ["call", "To'lov muddati haqida eslatildi"],
  ["warning", "Darsda telefon bilan chalg'iyapti"],
];
const DISCOUNT_REASONS = [
  "Aka-uka chegirmasi",
  "Faol o'quvchi",
  "Do'stini olib keldi",
  "Ijtimoiy himoya",
  "Doimiy mijoz",
];
const PAY_METHODS = [
  ["Naqd pul", 38],
  ["Plastik karta", 22],
  ["Click", 18],
  ["Payme", 14],
  ["Bank o'tkazmasi", 8],
] as const;

/* Ilova standartlari (apps/edu-crm/lib/server/finance.ts, expenses.ts, lib/leads.ts) — scripts apps'dan import qilmaydi */
const DEFAULT_PAYMENT_METHODS = ["Naqd pul", "Plastik karta", "Click", "Payme", "Bank o'tkazmasi"];
const DEFAULT_CATEGORIES = {
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
} as const;
const DEFAULT_LEAD_STAGES = [
  { name: "Yangi", color: "#3b82f6", kind: "open" },
  { name: "Bog'lanildi", color: "#f59e0b", kind: "open" },
  { name: "Sinov darsi", color: "#8b5cf6", kind: "open" },
  { name: "O'quvchi bo'ldi", color: "#10b981", kind: "won" },
  { name: "Yo'qotildi", color: "#ef4444", kind: "lost" },
] as const;
// [manba, ulush, o'quvchiga aylanish ehtimoli]
const SOURCES = [
  ["Instagram", 30, 0.25],
  ["Telegram", 20, 0.28],
  ["Tanish / Tavsiya", 18, 0.45],
  ["Banner / Reklama", 8, 0.15],
  ["Veb-sayt forma", 12, 0.28],
  ["Qo'ng'iroq", 9, 0.4],
  ["Boshqa", 3, 0.15],
] as const;

/* ---------- Telefonlar ---------- */

const usedPhones = new Set<string>();
const CODES = ["90", "91", "93", "94", "95", "97", "88", "99", "77", "33"];
const phone = () => {
  for (;;) {
    const p = `+998${pick(CODES)}${String(int(0, 9_999_999)).padStart(7, "0")}`;
    if (!usedPhones.has(p)) return (usedPhones.add(p), p);
  }
};

/* ---------- Hisob (apps/edu-crm/lib/billing.ts dan, qisqartirilgan) ---------- */

interface Pause {
  from: string;
  to: string | null;
}
interface G {
  id: string;
  name: string;
  courseId: string;
  teacherId: string;
  branchId: string;
  days: string[];
  startTime: string;
  endTime: string;
  startDate: string;
  /** Arxivga o'tgan sana (shu kunda a'zoliklar yopiladi) */
  closeDate: string | null;
  price: number;
  steps: { fromMonth: string; price: number }[];
  cap: number;
  isNew: boolean;
  /** Oxirgi ~3 kun davomat belgilanmagan */
  lagging: boolean;
  members: { enrolled: string; left: string | null }[];
  lessons: string[];
}
interface Mark {
  date: string;
  status: "present" | "late" | "excused" | "absent";
  reason: string | null;
}
interface Stu {
  id: string;
  name: string;
  phone: string;
  gender: "male" | "female";
  joinedAt: string;
  source: string;
  courseId: string | null;
  createdBy: string | null;
  dil: number;
  kid: boolean;
  leadIdx: number | null;
  discount: { percent: number; fromMonth: string; reason: string; affectsTeacher: boolean } | null;
  mems: Mem[];
}
interface Mem {
  id: string;
  stu: Stu;
  g: G;
  enrolledAt: string;
  activatedAt: string | null;
  leftAt: string | null;
  status: "trial" | "active" | "paused" | "left";
  pausedAt: string | null;
  leftReason: string | null;
  leftNote: string | null;
  pauses: Pause[];
  marks: Mark[];
  markMap: Map<string, Mark["status"]>;
}

const priceFor = (g: G, month: string) => {
  if (!g.steps.length) return g.price;
  const sorted = [...g.steps].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  let price = sorted[0]!.price;
  for (const s of sorted) if (s.fromMonth <= month) price = s.price;
  return price;
};
const scheduled = (g: G, month: string) =>
  eachDay(`${month}-01`, monthEnd(month)).filter((d) => g.days.includes(weekday(d)));
const isPaused = (pauses: Pause[], d: string) => pauses.some((p) => p.from <= d && (p.to === null || d < p.to));

function monthCharge(m: Mem, month: string) {
  const g = m.g;
  const all = scheduled(g, month);
  const dates = all.filter(
    (d) => d >= g.startDate && d >= m.activatedAt! && (m.leftAt === null || d < m.leftAt) && !isPaused(m.pauses, d),
  );
  const excused = dates.filter((d) => m.markMap.get(d) === "excused").length;
  const charged = dates.length - excused;
  const base = priceFor(g, month);
  const disc = m.stu.discount;
  const off = disc && disc.fromMonth <= month ? (base * disc.percent) / 100 : 0;
  const full = Math.max(0, Math.round(base - off));
  const amount = all.length > 0 && charged > 0 ? Math.round((full * charged) / all.length) : 0;
  return { amount, full };
}

/* ---------- Yozish yordamchisi ---------- */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function insertAll<T extends PgTable>(tx: Tx, table: T, rows: T["$inferInsert"][], size = 800) {
  for (let i = 0; i < rows.length; i += size) await tx.insert(table).values(rows.slice(i, i + size) as never);
}

/* ===================== O'qish: mavjud ma'lumot ===================== */

const [guard] = await db.select().from(settings).where(eq(settings.key, MARKER));
if (guard) fail(`${tenant.name}: namuna tarix allaqachon yozilgan (${MARKER}); ikkinchi marta yozilmaydi`);

const [branch] = await db.select({ id: branches.id }).from(branches).orderBy(asc(branches.createdAt)).limit(1);
if (!branch) fail("Filial topilmadi (avval pnpm edu:tenant)");
const courseRows = await db.select().from(courses);
const teacherRows = (await db.select().from(teachers).where(isNull(teachers.archivedAt))).filter(
  (t) => t.kind === "teacher",
);
const roomRows = await db.select().from(rooms);
const staffRows = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .where(isNull(users.archivedAt))
  .orderBy(asc(users.createdAt));
if (!courseRows.length || !teacherRows.length || !roomRows.length || !staffRows.length)
  fail("Kurs, o'qituvchi, xona yoki xodim yo'q (avval pnpm edu:seed)");
const staff = staffRows[0]!;
const courseByName = new Map(courseRows.map((c) => [c.name, c]));

for (const r of await db.select({ p: students.phone }).from(students)) usedPhones.add(r.p);
for (const r of await db.select({ p: leads.phone }).from(leads)) usedPhones.add(r.p);

const existingGroups = await db.select().from(groups);
const existingMems = await db.select().from(groupMemberships);
const roomCap = new Map(roomRows.map((r) => [r.id, r.capacity]));
const existingSalary = await db.select({ t: salaryEntries.teacherId, m: salaryEntries.month }).from(salaryEntries);
const hasSalary = new Set(existingSalary.filter((s) => s.t).map((s) => `${s.t}|${s.m}`));
const [{ maxReceipt }] = (await db
  .select({ maxReceipt: sql<number>`coalesce(max(${payments.receiptNo}), 0)`.mapWith(Number) })
  .from(payments)) as [{ maxReceipt: number }];

/* ===================== 1. Guruhlar ===================== */

const MWF = ["mon", "wed", "fri"];
const TTS = ["tue", "thu", "sat"];
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const SLOT_END = (start: string) => {
  const e = mins(start) + 90;
  return `${pad(Math.floor(e / 60))}:${pad(e % 60)}`;
};
const GROUP_PLAN = [
  { course: "IELTS", days: MWF, time: "11:00", from: "2025-04-07", close: "2025-12-26", raise: false },
  { course: "General English", days: TTS, time: "16:00", from: "2025-04-15", close: null, raise: true },
  { course: "Matematika", days: MWF, time: "17:00", from: "2025-06-02", close: null, raise: true },
  { course: "Nemis tili", days: TTS, time: "11:00", from: "2025-06-17", close: "2026-03-27", raise: false },
  { course: "Rus tili", days: MWF, time: "11:00", from: "2025-09-01", close: null, raise: true },
  { course: "Kimyo", days: TTS, time: "11:00", from: "2025-09-08", close: null, raise: true },
  { course: "Fizika", days: TTS, time: "16:00", from: "2025-10-06", close: "2026-06-26", raise: false },
  { course: "Python dasturlash", days: MWF, time: "17:00", from: "2025-11-03", close: null, raise: false },
  { course: "SAT Math", days: TTS, time: "16:00", from: "2026-01-12", close: null, raise: false },
  { course: "Koreys tili", days: MWF, time: "11:00", from: "2026-02-02", close: null, raise: false },
  { course: "Frontend (React)", days: MWF, time: "17:00", from: "2026-05-04", close: null, raise: false },
  { course: "Grafik dizayn", days: TTS, time: "11:00", from: "2026-08-24", close: null, raise: false },
] as const;

const G_ALL: G[] = existingGroups.map((g) => ({
  id: g.id,
  name: g.name,
  courseId: g.courseId,
  teacherId: g.teacherId,
  branchId: g.branchId,
  days: g.days,
  startTime: g.startTime,
  endTime: g.endTime,
  startDate: g.startDate,
  closeDate: g.archivedAt ? tashkentDate(g.archivedAt) : null,
  price: g.price,
  steps: [],
  cap: Math.min(16, roomCap.get(g.roomId ?? "") ?? 15),
  isNew: false,
  lagging: false,
  members: existingMems.filter((m) => m.groupId === g.id).map((m) => ({ enrolled: m.enrolledAt, left: m.leftAt })),
  lessons: [],
}));

const clash = (
  a: { days: readonly string[]; time: string; from: string; to: string | null; teacherId: string; roomId: string },
  b: {
    days: readonly string[];
    startTime: string;
    endTime: string;
    startDate: string;
    closeDate: string | null;
    teacherId: string;
    roomId: string | null;
  },
) =>
  (a.teacherId === b.teacherId || a.roomId === b.roomId) &&
  a.days.some((d) => b.days.includes(d)) &&
  mins(a.time) < mins(b.endTime) &&
  mins(b.startTime) < mins(a.time) + 90 &&
  a.from <= (b.closeDate ?? "9999") &&
  b.startDate <= (a.to ?? "9999");

const newGroupRows: (typeof groups.$inferInsert)[] = [];
const groupPriceRows: (typeof groupPrices.$inferInsert)[] = [];
const roomOf = new Map<string, string>();
const placed = existingGroups.map((g) => ({
  days: g.days,
  startTime: g.startTime,
  endTime: g.endTime,
  startDate: g.startDate,
  closeDate: g.archivedAt ? tashkentDate(g.archivedAt) : null,
  teacherId: g.teacherId,
  roomId: g.roomId,
}));
GROUP_PLAN.forEach((p, i) => {
  const course = courseByName.get(p.course);
  if (!course) fail(`Kurs topilmadi: ${p.course}`);
  let teacher = teacherRows[0]!;
  let room = roomRows[0]!;
  search: for (let a = 0; a < teacherRows.length; a++) {
    for (let b = 0; b < roomRows.length; b++) {
      const t = teacherRows[(i * 3 + a) % teacherRows.length]!;
      const r = roomRows[(i * 2 + b) % roomRows.length]!;
      if (
        !placed.some((o) =>
          clash({ days: p.days, time: p.time, from: p.from, to: p.close, teacherId: t.id, roomId: r.id }, o),
        )
      ) {
        teacher = t;
        room = r;
        break search;
      }
    }
  }
  const id = randomUUID();
  const price = p.raise ? round(course.price * 1.1, 10_000) : course.price;
  const endTime = SLOT_END(p.time);
  placed.push({
    days: [...p.days],
    startTime: p.time,
    endTime,
    startDate: p.from,
    closeDate: p.close,
    teacherId: teacher.id,
    roomId: room.id,
  });
  roomOf.set(id, room.id);
  newGroupRows.push({
    id,
    branchId: teacher.branchId,
    courseId: course.id,
    teacherId: teacher.id,
    roomId: room.id,
    name: `${course.name} ${p.from.slice(5, 7)}/${p.from.slice(2, 4)}`,
    price,
    durationMonths: course.durationMonths,
    days: [...p.days],
    startTime: p.time,
    endTime,
    startDate: p.from,
    color: COLORS[i % COLORS.length]!,
    archivedAt: p.close ? ts(p.close, 18) : null,
    ...stamp(ts(addDays(p.from, -7), 10)),
  });
  // Narx oshgan guruhlar: 2026-yanvardan yangi narx (billing: "boshidan" qadami eski narx)
  const steps = p.raise
    ? [
        { fromMonth: "0000-01", price: course.price },
        { fromMonth: "2026-01", price },
      ]
    : [];
  for (const s of steps)
    groupPriceRows.push({ groupId: id, fromMonth: s.fromMonth, price: s.price, createdBy: staff.id });
  G_ALL.push({
    id,
    name: `${course.name}`,
    courseId: course.id,
    teacherId: teacher.id,
    branchId: teacher.branchId,
    days: [...p.days],
    startTime: p.time,
    endTime,
    startDate: p.from,
    closeDate: p.close,
    price,
    steps,
    cap: Math.min(16, room.capacity),
    isNew: true,
    lagging: false,
    members: [],
    lessons: [],
  });
});
// Davomati ortda qoladigan guruhlar (belgilanmagan darslar bo'lishi uchun)
for (const g of G_ALL.filter((x) => x.isNew && !x.closeDate)) g.lagging = chance(0.4);
for (const g of G_ALL) g.lessons = eachDay(g.startDate, YESTERDAY).filter((d) => g.days.includes(weekday(d)));

/* ===================== 2. Lidlar: reja ===================== */

// Mavsumiylik: yanvar–fevral va avgust–sentabr tepa, iyun–iyul past
const SEASON = [1.5, 1.2, 1.0, 0.9, 0.8, 0.4, 0.4, 1.6, 1.8, 1.0, 0.8, 0.8];
const DAY_W = { sun: 0.35, sat: 0.8 } as Record<string, number>;
const WINDOW = eachDay(START, TODAY);
const cum: number[] = [];
WINDOW.reduce((s, d) => {
  const w = SEASON[Number(d.slice(5, 7)) - 1]! * (DAY_W[weekday(d)] ?? 1);
  cum.push(s + w);
  return s + w;
}, 0);
const sampleDay = (minDate = START) => {
  for (;;) {
    const x = rand() * cum[cum.length - 1]!;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! > x) hi = mid;
      else lo = mid + 1;
    }
    if (WINDOW[lo]! >= minDate) return WINDOW[lo]!;
  }
};

interface LeadPlan {
  name: string;
  phone: string;
  gender: "male" | "female";
  source: string;
  courseId: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: Date;
  note: string | null;
  /** [bosqich 0..2 yoki 3=won, 4=lost, vaqt] */
  events: { stage: number; at: Date }[];
  want: "won" | "lost" | "open";
  reach: number;
  lostReason: string | null;
  lostNote: string | null;
  targetDate: string | null;
  stu: Stu | null;
  group: G | null;
}

const hoursAfter = (at: Date, h: number) => new Date(at.getTime() + h * 3_600_000);
const popular = courseRows.map(
  (c) => [c.id, ["IELTS", "General English", "Matematika"].includes(c.name) ? 3 : 1] as const,
);

function leadPlan(): LeadPlan {
  const day = sampleDay();
  const hour = weighted([
    [9, 2],
    [10, 3],
    [11, 3],
    [12, 2],
    [13, 2],
    [14, 3],
    [15, 3],
    [16, 3],
    [17, 3],
    [18, 3],
    [19, 2],
    [20, 1],
  ] as const);
  const createdAt = past(day, hour, int(0, 59));
  const [source, , conv] = weighted(SOURCES.map((s) => [s, s[1]] as const));
  const male = chance(0.5);
  const age = diffDays(day, TODAY);
  const gate = age < 5 ? 0.15 : age < 14 ? 0.6 : 1;
  const r = rand();
  const want: LeadPlan["want"] =
    r < conv * 1.05 * gate
      ? "won"
      : chance(age < 14 ? 0.05 : age < 45 ? 0.25 : age < 120 ? 0.5 : 0.67)
        ? "lost"
        : "open";
  const reach =
    want === "won"
      ? 2
      : want === "lost"
        ? weighted([
            [0, 40],
            [1, 38],
            [2, 22],
          ] as const)
        : age < 3
          ? weighted([
              [0, 60],
              [1, 30],
              [2, 10],
            ] as const)
          : age < 14
            ? weighted([
                [0, 30],
                [1, 45],
                [2, 25],
              ] as const)
            : weighted([
                [0, 20],
                [1, 40],
                [2, 40],
              ] as const);
  const assigned = chance(0.78) ? staff.id : null;
  return {
    name: personName(male),
    phone: phone(),
    gender: male ? "male" : "female",
    source,
    courseId: weighted(popular),
    assignedTo: assigned,
    createdBy: source === "Veb-sayt forma" ? null : staff.id,
    createdAt,
    note: chance(0.2) ? pick(LEAD_NOTES) : null,
    events: [],
    want,
    reach,
    lostReason: null,
    lostNote: null,
    targetDate: null,
    stu: null,
    group: null,
  };
}

/** Bosqich almashuvlari: ketma-ket, soatlar–kunlar oralig'ida; kelajakka chiqib ketsa ochiq qoladi */
function timeline(p: LeadPlan) {
  const ev = [{ stage: 0, at: p.createdAt }];
  let t = p.createdAt;
  let reached = 0;
  for (let s = 1; s <= p.reach; s++) {
    t = hoursAfter(t, s === 1 ? (chance(0.6) ? between(0.5, 20) : between(24, 72)) : between(24, 144));
    if (t > NOW) break;
    ev.push({ stage: s, at: t });
    reached = s;
  }
  let want = reached < p.reach && p.want !== "open" ? "open" : p.want;
  if (want !== "open") {
    const gap =
      want === "won"
        ? between(24, 7 * 24)
        : reached === 2
          ? between(24, 12 * 24)
          : between(48, (reached ? 30 : 25) * 24);
    const end = hoursAfter(t, gap);
    if (end > NOW) want = "open";
    else ev.push({ stage: want === "won" ? 3 : 4, at: end });
  }
  p.events = ev;
  p.want = want as LeadPlan["want"];
  p.reach = reached;
}

const lostReasonFor = (stage: number) =>
  stage === 0 && chance(0.55) ? "Javob bermadi" : weighted(LOST_REASONS.map((r) => [r[0], r[1]] as const));

const leadPlans: LeadPlan[] = Array.from({ length: 350 }, leadPlan).sort(
  (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
);
for (const p of leadPlans) timeline(p);

/* ===================== 3. O'quvchilar va a'zolik ===================== */

const stuList: Stu[] = [];
const memList: Mem[] = [];

function newStudent(init: {
  name: string;
  phone: string;
  gender: "male" | "female";
  joinedAt: string;
  source: string;
  courseId: string | null;
  leadIdx: number | null;
}): Stu {
  return {
    id: randomUUID(),
    ...init,
    createdBy: staff.id,
    dil: 0.4 + rand() * 1.2,
    kid: chance(0.65),
    discount: null,
    mems: [],
  };
}

function eligible(g: G, d: string) {
  if (g.startDate > d) return false;
  if (g.closeDate && d > addDays(g.closeDate, -21)) return false;
  return true;
}
const fill = (g: G, d: string) => g.members.filter((m) => m.enrolled <= d && (m.left === null || m.left > d)).length;

function chooseGroup(d: string, notCourse: Set<string> = new Set()): G | null {
  const opts = G_ALL.filter((g) => eligible(g, d) && !notCourse.has(g.courseId) && fill(g, d) < g.cap).map((g) => {
    const fresh = diffDays(g.startDate, d) < 45 ? 1.6 : 1;
    return [g, (1 - fill(g, d) / g.cap + 0.1) * fresh] as const;
  });
  return opts.length ? weighted(opts) : null;
}

function leaveReason(trial: boolean) {
  const base = LEAVE_REASONS.filter(([r]) => trial || r !== "Kursni tugatdi" || chance(0.5)).map(
    (r) => [r[0], r[1]] as const,
  );
  return weighted(
    trial
      ? base.map(([r, w]) => [r, r === "Vaqti to'g'ri kelmadi" ? w * 1.4 : r === "Kursni tugatdi" ? 0 : w] as const)
      : base,
  );
}

function makeMembership(stu: Stu, g: G, enrolledAt: string, transfer = false): Mem {
  const delay = transfer ? 0 : int(5, 10);
  let activatedAt: string | null = addDays(enrolledAt, delay);
  let leftAt: string | null = null;
  let leftReason: string | null = null;
  let status: Mem["status"] = "active";
  let pausedAt: string | null = null;
  const pauses: Pause[] = [];
  const trialLeave = !transfer && chance(0.25);
  if (trialLeave) {
    activatedAt = null;
    const l = addDays(enrolledAt, int(2, 9));
    if (l <= TODAY) {
      leftAt = l;
      leftReason = leaveReason(true);
    }
  } else if (activatedAt > TODAY) {
    activatedAt = null;
  }
  if (activatedAt) {
    if (chance(0.35)) {
      const l = addDays(activatedAt, Math.round(14 + -Math.log(1 - rand()) * 110));
      if (l <= TODAY) {
        leftAt = l;
        leftReason = leaveReason(false);
      }
    }
    if (!leftAt && chance(0.04)) {
      const from = addDays(activatedAt, int(20, 40));
      const to = addDays(from, int(14, 28));
      if (to < TODAY && (!g.closeDate || to < g.closeDate)) pauses.push({ from, to });
    }
    if (!leftAt && !g.closeDate && chance(0.03) && diffDays(activatedAt, TODAY) > 20) {
      pausedAt = addDays(TODAY, -int(3, 30));
      if (pausedAt < activatedAt) pausedAt = null;
      else {
        status = "paused";
        pauses.push({ from: pausedAt, to: null });
      }
    }
  }
  // Guruh yopilganda ochiq qolganlar yopiladi
  if (g.closeDate && (leftAt === null || leftAt > g.closeDate)) {
    leftAt = g.closeDate;
    leftReason = "Guruh yopildi";
  }
  if (leftAt) status = "left";
  else if (!activatedAt) status = "trial";
  const leftNote = leftReason && chance(0.4) ? pick(LEAVE_NOTES[leftReason] ?? ["Izoh yo'q"]) : null;
  const m: Mem = {
    id: randomUUID(),
    stu,
    g,
    enrolledAt,
    activatedAt,
    leftAt,
    status,
    pausedAt: status === "paused" ? pausedAt : null,
    leftReason,
    leftNote,
    pauses,
    marks: [],
    markMap: new Map(),
  };
  g.members.push({ enrolled: enrolledAt, left: leftAt });
  stu.mems.push(m);
  memList.push(m);
  return m;
}

// Direct o'quvchilar: lidlardan keyin to'ldiriladi (jami ~150)
interface Joiner {
  date: string;
  kind: "lead" | "direct" | "second";
  lead?: LeadPlan;
  stu?: Stu;
  name?: string;
}
const joiners: Joiner[] = [];
leadPlans.forEach((p) => {
  if (p.want === "won") joiners.push({ date: tashkentDate(p.events.at(-1)!.at), kind: "lead", lead: p });
});
const wonPlanned = joiners.length;
const directCount = Math.max(30, 150 - wonPlanned);
for (let i = 0; i < directCount; i++) joiners.push({ date: sampleDay(), kind: "direct" });
joiners.sort((a, b) => a.date.localeCompare(b.date));

const queueSecond = (from: number, j: Joiner) => {
  const at = joiners.findIndex((x, idx) => idx > from && x.date > j.date);
  joiners.splice(at < 0 ? joiners.length : at, 0, j);
};
const droppedLeads: LeadPlan[] = [];
for (let i = 0; i < joiners.length; i++) {
  const j = joiners[i]!;
  if (j.kind === "second") {
    const first = j.stu!.mems[0];
    if (!first) continue;
    if (first.leftAt !== null && first.leftAt <= j.date) continue;
    const g = chooseGroup(j.date, new Set(j.stu!.mems.map((m) => m.g.courseId)));
    if (g) makeMembership(j.stu!, g, j.date);
    continue;
  }
  const g = chooseGroup(j.date);
  if (j.kind === "lead") {
    const p = j.lead!;
    if (!g) {
      droppedLeads.push(p);
      continue;
    }
    p.group = g;
    p.courseId = g.courseId;
    const stu = newStudent({
      name: p.name,
      phone: p.phone,
      gender: p.gender,
      joinedAt: j.date,
      source: p.source,
      courseId: g.courseId,
      leadIdx: leadPlans.indexOf(p),
    });
    p.stu = stu;
    stuList.push(stu);
    makeMembership(stu, g, j.date);
    if (chance(0.12)) {
      const d2 = addDays(j.date, int(20, 150));
      if (d2 <= addDays(TODAY, -10)) queueSecond(i, { date: d2, kind: "second", stu });
    }
  } else {
    if (!g) continue;
    const male = chance(0.5);
    const src = weighted(SOURCES.map((s) => [s[0], s[1]] as const));
    const stu = newStudent({
      name: personName(male),
      phone: phone(),
      gender: male ? "male" : "female",
      joinedAt: j.date,
      source: src,
      courseId: g.courseId,
      leadIdx: null,
    });
    stuList.push(stu);
    makeMembership(stu, g, j.date);
    if (chance(0.12)) {
      const d2 = addDays(j.date, int(20, 150));
      if (d2 <= addDays(TODAY, -10)) queueSecond(i, { date: d2, kind: "second", stu });
    }
  }
}
// Yopilgan guruh o'quvchilarining ~55% boshqa guruhga o'tadi (davom etadi)
for (const m of [...memList].filter((x) => x.leftReason === "Guruh yopildi")) {
  if (!chance(0.55)) continue;
  const g = chooseGroup(m.leftAt!, new Set([m.g.courseId]));
  if (g) makeMembership(m.stu, g, m.leftAt!, true);
}
// Guruh topilmagan g'olib lidlar — yo'qotilgan deb yoziladi (vaqt o'sha)
for (const p of droppedLeads) {
  p.events[p.events.length - 1] = { stage: 4, at: p.events.at(-1)!.at };
  p.want = "lost";
}

// Doimiy chegirmalar (~8%)
const paying = stuList.filter((s) => s.mems.some((m) => m.activatedAt));
const discounted = new Set([...paying].sort(() => rand() - 0.5).slice(0, Math.round(paying.length * 0.08)));
for (const s of paying) {
  if (!discounted.has(s)) continue;
  const first = s.mems.filter((m) => m.activatedAt).sort((a, b) => a.activatedAt!.localeCompare(b.activatedAt!))[0]!;
  s.discount = {
    percent: pick([10, 15, 20]),
    fromMonth: first.activatedAt!.slice(0, 7),
    reason: pick(DISCOUNT_REASONS),
    affectsTeacher: chance(0.7),
  };
}

/* ===================== 4. Davomat ===================== */

const lastMarkOf = (g: G) => (g.lagging ? addDays(TODAY, -4) : YESTERDAY);
for (const m of memList) {
  const g = m.g;
  const to = lastMarkOf(g);
  const dates = g.lessons.filter(
    (d) =>
      d >= m.enrolledAt &&
      d >= g.startDate &&
      d <= to &&
      (m.leftAt === null || d < m.leftAt) &&
      !(m.pausedAt && d >= m.pausedAt) &&
      !m.pauses.some((p) => p.to !== null && p.from <= d && d < p.to),
  );
  let prevAbsent = false;
  for (const d of dates) {
    let status: Mark["status"];
    if (prevAbsent ? chance(0.3) : chance(0.062 * m.stu.dil)) status = "absent";
    else status = chance(0.05) ? "excused" : chance(0.065) ? "late" : "present";
    prevAbsent = status === "absent";
    m.marks.push({ date: d, status, reason: status === "excused" ? pick(ABSENCE_REASONS) : null });
  }
  // Ketayotganlar oxirgi darslarni ko'pincha qoldiradi
  if (m.leftAt && m.marks.length >= 3 && chance(m.activatedAt ? 0.5 : 0.4)) {
    for (const mk of m.marks.slice(-(m.activatedAt ? int(2, 3) : 1))) {
      mk.status = "absent";
      mk.reason = null;
    }
  }
}

// Xavfli o'quvchilar: ~10 ta faol o'quvchi oxirgi 2–4 darsni ketma-ket qoldirgan
const riskPool = memList.filter(
  (m) =>
    m.status === "active" &&
    !m.g.closeDate &&
    !m.g.lagging &&
    m.activatedAt! <= addDays(TODAY, -30) &&
    m.marks.length >= 8,
);
const riskNotes: (typeof studentNotes.$inferInsert)[] = [];
const riskStudents = new Set<string>();
for (let n = 0; n < 10 && riskPool.length; n++) {
  const m = riskPool.splice(Math.floor(rand() * riskPool.length), 1)[0]!;
  if (riskStudents.has(m.stu.id)) continue;
  riskStudents.add(m.stu.id);
  const k = pick([2, 3, 3, 4]);
  m.marks.slice(-k).forEach((mk) => {
    mk.status = "absent";
    mk.reason = null;
  });
  m.marks[m.marks.length - k - 1]!.status = "present";
  if (n % 2 === 0) {
    const lm = m.marks.at(-1)!.date;
    let at = ts(addDays(lm, 1), 10, 15);
    if (at > NOW) at = ts(lm, 19, 30);
    riskNotes.push({
      studentId: m.stu.id,
      kind: "call",
      text: pick(CALL_NOTES),
      authorId: staff.id,
      authorName: staff.name,
      createdAt: at,
    });
  }
}
for (const m of memList) m.markMap = new Map(m.marks.map((mk) => [mk.date, mk.status]));

/* ===================== 5. To'lovlar ===================== */

interface PayPlan {
  stu: Stu;
  m: Mem;
  kind: "payment" | "refund" | "discount";
  amount: number;
  month: string;
  date: string;
  note: string | null;
}
const payPlans: PayPlan[] = [];
const clampDate = (d: string, lo: string, hi: string) => (d < lo ? lo : d > hi ? hi : d);

for (const m of memList) {
  if (!m.activatedAt) continue;
  const g = m.g;
  const startMonth = (m.activatedAt > g.startDate ? m.activatedAt : g.startDate).slice(0, 7);
  let endMonth = CUR_MONTH;
  if (m.leftAt) {
    const last = addDays(m.leftAt, -1).slice(0, 7);
    if (last < endMonth) endMonth = last;
  }
  const months = monthsBetween(startMonth, endMonth);
  months.forEach((month, idx) => {
    const { amount, full } = monthCharge(m, month);
    if (amount <= 0) return;
    const isCur = month === CUR_MONTH;
    const isLast = idx === months.length - 1;
    const lo = clampDate(`${month}-01`, m.activatedAt!, "9999");
    const hi = isCur ? TODAY : clampDate(monthEnd(month), "0000", m.leftAt ? addDays(m.leftAt, -1) : "9999");
    const pickDate = (first: boolean) => {
      if (first) return clampDate(addDays(m.activatedAt!, int(0, 3)), lo, hi);
      const dd = weighted([
        [int(1, 10), 70],
        [int(11, 20), 25],
        [int(21, 28), 5],
      ] as const);
      return clampDate(`${month}-${pad(dd)}`, lo, hi);
    };
    const paidProb = isCur ? (m.activatedAt!.slice(0, 7) === month ? 0.85 : 0.8) : 0.97;
    if (!chance(paidProb)) {
      // Keyinroq to'langan (sana keyingi oylarda, oy — o'sha)
      if (!isLast && !isCur && chance(0.45)) {
        const late = addDays(`${month}-28`, int(8, 50));
        if (late <= TODAY)
          payPlans.push({ stu: m.stu, m, kind: "payment", amount, month, date: late, note: "Kechikib to'langan" });
      }
      return;
    }
    let pay = amount;
    const r = rand();
    if (!isCur && r < 0.09) pay = Math.max(10_000, round(amount * between(0.4, 0.8), 10_000));
    else if (r > 0.94) {
      const off = Math.max(10_000, round(amount * between(0.1, 0.3), 10_000));
      if (off < amount) {
        pay = amount - off;
        payPlans.push({
          stu: m.stu,
          m,
          kind: "discount",
          amount: off,
          month,
          date: pickDate(idx === 0),
          note: "Bir martalik chegirma",
        });
      }
    }
    payPlans.push({ stu: m.stu, m, kind: "payment", amount: pay, month, date: pickDate(idx === 0), note: null });
  });
}

// Qaytarishlar: ketgan ba'zi o'quvchilar oxirgi oyni to'liq to'lab, ortig'ini qaytarib olgan
const refundable = memList.filter(
  (m) => m.activatedAt && m.leftAt && m.leftAt <= addDays(TODAY, -5) && m.leftReason !== "Guruh yopildi",
);
let refunds = 0;
for (const m of refundable.sort(() => rand() - 0.5)) {
  if (refunds >= 14) break;
  const month = addDays(m.leftAt!, -1).slice(0, 7);
  const { amount, full } = monthCharge(m, month);
  const idx = payPlans.findIndex((p) => p.m === m && p.month === month && p.kind === "payment" && p.amount === amount);
  const extra = round(full - amount, 10_000);
  if (idx < 0 || extra < 50_000) continue;
  payPlans[idx]!.amount = amount + extra;
  payPlans.push({
    stu: m.stu,
    m,
    kind: "refund",
    amount: extra,
    month,
    date: clampDate(addDays(m.leftAt!, int(1, 5)), "0000", TODAY),
    note: "Ortiqcha to'lov qaytarildi",
  });
  refunds++;
}

/* ===================== 6. Xarajat, daromad, maosh, reja ===================== */

const dayIn = (month: string, a: number, b: number) => `${month}-${pad(int(a, b))}`;
const methodNames = () => weighted(PAY_METHODS.map((m) => [m[0], m[1]] as const));
const allMonths = monthsBetween(START.slice(0, 7), CUR_MONTH);
const ELEC = [1.5, 1.4, 1.1, 0.9, 0.8, 1.0, 1.3, 1.3, 1.0, 0.9, 1.1, 1.4];
const ADS = [1.2, 1.1, 0.8, 0.8, 0.8, 1.0, 2.2, 3.0, 2.6, 1.3, 0.8, 0.9];
const STATIONERY = [1, 1, 1, 1, 0.8, 0.8, 1, 2, 2, 1.2, 1, 1];

interface ExpPlan {
  kind: "fixed" | "variable";
  cat: string;
  reason: string;
  amount: number;
  date: string;
  who?: "user" | "teacher";
  bank?: boolean;
}
const expPlans: ExpPlan[] = [];
for (const month of allMonths) {
  const mi = Number(month.slice(5, 7)) - 1;
  const add = (e: ExpPlan) => e.date <= TODAY && expPlans.push(e);
  add({
    kind: "fixed",
    cat: "Ofis xarajatlari",
    reason: "Ijara",
    amount: month >= "2026-01" ? 4_500_000 : 4_000_000,
    date: dayIn(month, 3, 6),
    bank: true,
  });
  add({
    kind: "fixed",
    cat: "Kommunal to'lovlar",
    reason: "Elektr energiya",
    amount: round(450_000 * ELEC[mi]! * between(0.9, 1.1), 10_000),
    date: dayIn(month, 8, 14),
  });
  add({
    kind: "fixed",
    cat: "Kommunal to'lovlar",
    reason: "Tabiiy gaz",
    amount: round([10, 11, 0, 1, 2].includes(mi) ? between(600_000, 1_400_000) : between(100_000, 160_000), 10_000),
    date: dayIn(month, 8, 14),
  });
  add({
    kind: "fixed",
    cat: "Kommunal to'lovlar",
    reason: "Suv va kanalizatsiya",
    amount: round(between(140_000, 190_000), 10_000),
    date: dayIn(month, 8, 14),
  });
  add({
    kind: "fixed",
    cat: "Internet va aloqa",
    reason: "Internet (optik tola)",
    amount: 350_000,
    date: dayIn(month, 1, 5),
    bank: true,
  });
  add({
    kind: "fixed",
    cat: "Internet va aloqa",
    reason: "Telefon aloqa",
    amount: round(between(150_000, 210_000), 10_000),
    date: dayIn(month, 1, 5),
  });
  add({
    kind: "fixed",
    cat: "Dasturiy ta'minot",
    reason: "CRM va xosting obunasi",
    amount: 350_000,
    date: dayIn(month, 1, 6),
    bank: true,
  });
  const ads = ["Instagram targeti", "Telegram kanallarida reklama", "Banner va flayer chop etish"];
  if ([6, 7, 8].includes(mi)) ads.push("Blogerlar bilan hamkorlik");
  for (const a of ads)
    if (a !== "Banner va flayer chop etish" || chance(0.5))
      add({
        kind: "variable",
        cat: "Reklama va marketing",
        reason: a,
        amount: round(between(300_000, 800_000) * ADS[mi]!, 50_000),
        date: dayIn(month, 5, 26),
        who: chance(0.15) ? "user" : undefined,
      });
  add({
    kind: "variable",
    cat: "Kantselyariya",
    reason: pick(["Marker, qog'oz va daftarlar", "Printer qog'ozi va siyoh", "Doska markerlari"]),
    amount: round(between(250_000, 600_000) * STATIONERY[mi]!, 10_000),
    date: dayIn(month, 4, 24),
    who: chance(0.2) ? "user" : undefined,
  });
  add({
    kind: "variable",
    cat: "Choy va kofe / oshxona",
    reason: "Choy, shakar va suv",
    amount: round(between(350_000, 700_000), 10_000),
    date: dayIn(month, 6, 25),
  });
  if (chance(0.35))
    add({
      kind: "variable",
      cat: "Jihozlar va texnika",
      reason: pick([
        "Proyektor ta'mirlash",
        "Konditsioner ta'mirlash",
        "Stol va stul xarid",
        "Kompyuter ehtiyot qismlari",
        "Doska almashtirish",
      ]),
      amount: round(between(700_000, 4_500_000), 50_000),
      date: dayIn(month, 6, 27),
      who: chance(0.15) ? "teacher" : undefined,
    });
  if (chance(0.4))
    add({
      kind: "variable",
      cat: "Transport va yoqilg'i",
      reason: "Taksi va hujjat yetkazish",
      amount: round(between(120_000, 300_000), 10_000),
      date: dayIn(month, 3, 27),
    });
  if (chance(0.25))
    add({
      kind: "variable",
      cat: "Boshqa xarajatlar",
      reason: pick(["Bayram tadbiri", "O'quvchilarga sovg'alar", "Mukofotlar"]),
      amount: round(between(300_000, 1_500_000), 50_000),
      date: dayIn(month, 5, 27),
    });
}

const INCOME_TITLES = {
  Kitoblar: [
    "IELTS kitoblari sotuvi",
    "Ingliz tili darsliklari sotuvi",
    "Matematika to'plamlari sotuvi",
    "Lug'at va qo'llanmalar sotuvi",
  ],
  "Mock imtihon": ["IELTS mock imtihon", "SAT sinov imtihoni", "Umumiy sinov testi"],
  Sertifikat: ["Sertifikat berish", "Kurs yakuni sertifikatlari"],
  "Zal ijarasi": ["Zalni ijaraga berish", "Seminar uchun xona ijarasi"],
  Boshqa: ["Pechat va nusxa ko'chirish", "Boshqa tushum"],
} as const;
const COMPANIES = ["Bilim Plus MCHJ", "Nur Ta'lim", "Kelajak Akademiyasi", "Yosh Olimlar Klubi"];
interface IncPlan {
  cat: string;
  title: string;
  amount: number;
  date: string;
  payer: string | null;
}
const incPlans: IncPlan[] = [];
for (const month of allMonths) {
  const mi = Number(month.slice(5, 7)) - 1;
  const add = (cat: keyof typeof INCOME_TITLES, amount: number, payer: string | null = null) => {
    const date = dayIn(month, 2, 27);
    if (date <= TODAY)
      incPlans.push({ cat, title: pick(INCOME_TITLES[cat]), amount: round(amount, 10_000), date, payer });
  };
  for (let i = 0; i < int(1, 3); i++) add("Kitoblar", int(3, 12) * int(90, 250) * 1000);
  if ([2, 5, 8, 11].includes(mi) || chance(0.2)) add("Mock imtihon", int(10, 25) * 150_000, personName(chance(0.5)));
  if (chance(0.35)) add("Sertifikat", int(1, 5) * 100_000);
  if (chance(0.25)) add("Zal ijarasi", between(700_000, 1_800_000), pick(COMPANIES));
  if (chance(0.15)) add("Boshqa", between(100_000, 400_000));
}

// Maosh: o'qituvchi × oy (hisob — to'lovlardan; ilovadagi formulaning soddalashtirilgani)
const teacherOf = new Map(G_ALL.map((g) => [g.id, g.teacherId]));
const revenue = new Map<string, { sum: number; students: Set<string> }>();
for (const p of payPlans) {
  if (p.kind !== "payment") continue;
  const key = `${teacherOf.get(p.m.g.id)}|${p.month}`;
  const r = revenue.get(key) ?? { sum: 0, students: new Set<string>() };
  r.sum += p.amount;
  r.students.add(p.stu.id);
  revenue.set(key, r);
}
interface SalPlan {
  teacherId: string;
  kind: "salary" | "advance";
  amount: number;
  month: string;
  date: string;
}
const salPlans: SalPlan[] = [];
for (const t of teacherRows) {
  for (const month of allMonths) {
    if (hasSalary.has(`${t.id}|${month}`)) continue;
    const r = revenue.get(`${t.id}|${month}`);
    const active = G_ALL.some(
      (g) =>
        g.teacherId === t.id &&
        g.isNew &&
        g.startDate <= monthEnd(month) &&
        (!g.closeDate || g.closeDate >= `${month}-01`),
    );
    if (!r && !active) continue;
    let total = 0;
    if (t.salaryType === "percent") total = ((r?.sum ?? 0) * t.revenueSharePercent) / 100;
    else if (t.salaryType === "per_student") total = (r?.students.size ?? 0) * t.perStudentSalary;
    else total = r ? Math.min(t.fixedSalary, r.sum * 0.55) : 0;
    total = round(total, 10_000);
    if (total < 100_000) continue;
    const isCur = month === CUR_MONTH;
    const advance = chance(isCur ? 0.4 : 0.3) ? Math.max(100_000, round(total * between(0.25, 0.4), 50_000)) : 0;
    if (advance && advance < total) {
      const date = isCur ? clampDate(addDays(TODAY, -int(1, 4)), `${month}-01`, TODAY) : `${month}-${pad(int(17, 22))}`;
      salPlans.push({ teacherId: t.id, kind: "advance", amount: advance, month, date });
    }
    if (isCur) continue;
    const date = `${addMonths(month, 1)}-${pad(int(5, 12))}`;
    if (date > TODAY) continue;
    salPlans.push({
      teacherId: t.id,
      kind: "salary",
      amount: advance && advance < total ? total - advance : total,
      month,
      date,
    });
  }
}

/* ===================== 7. Lidlar: yakuniy holat ===================== */

const stages = await db.select().from(leadStages).orderBy(asc(leadStages.position));
const stageIds = {
  open: stages.filter((s) => s.kind === "open").map((s) => s.id),
  won: stages.find((s) => s.kind === "won")?.id,
  lost: stages.find((s) => s.kind === "lost")?.id,
};
const needStages = stages.length === 0;

interface FirstPlan {
  p: LeadPlan;
  group: G;
  date: string;
  status: "came" | "absent";
}
const firstLessons: FirstPlan[] = [];
for (const p of leadPlans) {
  const last = p.events.at(-1)!;
  if (p.want === "lost") {
    const from = p.events.length >= 2 ? p.events[p.events.length - 2]!.stage : 0;
    p.lostReason = lostReasonFor(from);
    p.lostNote = chance(0.35) ? pick(LOST_NOTES) : null;
  }
  if (p.want === "open" && chance(0.65)) p.targetDate = addDays(TODAY, int(-5, 6));
  // Birinchi dars: Sinov darsi bosqichiga yetganlarning ~40 foizi
  const sinov = p.events.find((e) => e.stage === 2);
  if (!sinov || !chance(0.4)) continue;
  const sinovDate = tashkentDate(sinov.at);
  const until = p.want === "won" ? addDays(tashkentDate(last.at), -1) : YESTERDAY;
  const g = p.want === "won" ? p.group : chooseGroup(sinovDate);
  if (!g) continue;
  const date = g.lessons.find((d) => d > sinovDate && d <= until && eligible(g, d));
  if (!date) continue;
  const status = p.want === "won" ? (chance(0.9) ? "came" : "absent") : chance(0.55) ? "came" : "absent";
  firstLessons.push({ p, group: g, date, status });
}

/* ===================== Yozish (bitta tranzaksiya) ===================== */

const noteRows: (typeof studentNotes.$inferInsert)[] = [...riskNotes];
for (let i = 0; i < 30; i++) {
  const s = pick(stuList);
  const [kind, text] = pick(OTHER_NOTES);
  noteRows.push({
    studentId: s.id,
    kind: kind as (typeof studentNotes.$inferInsert)["kind"],
    text,
    authorId: staff.id,
    authorName: staff.name,
    createdAt: past(addDays(s.joinedAt, int(5, 60)), int(10, 18), int(0, 59)),
  });
}

await db.transaction(async (tx) => {
  // To'lov usullari, toifalar va lid bosqichlari: yo'q bo'lsa ilovadagidek yaratiladi
  let methods = await tx.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder));
  if (!methods.length) {
    await tx
      .insert(paymentMethods)
      .values(DEFAULT_PAYMENT_METHODS.map((name, i) => ({ name, sortOrder: i })))
      .onConflictDoNothing();
    methods = await tx.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder));
  }
  const methodId = (name: string) => (methods.find((m) => m.name === name) ?? methods[0]!).id;
  let cats = await tx.select().from(financeCategories);
  for (const kind of ["expense", "income"] as const) {
    if (cats.some((c) => c.kind === kind)) continue;
    await tx
      .insert(financeCategories)
      .values(DEFAULT_CATEGORIES[kind].map((name, i) => ({ kind, name, sortOrder: i })))
      .onConflictDoNothing();
  }
  cats = await tx.select().from(financeCategories);
  const catId = (kind: "expense" | "income", name: string) =>
    (cats.find((c) => c.kind === kind && c.name === name) ?? cats.find((c) => c.kind === kind)!).id;
  if (needStages) {
    const created = await tx
      .insert(leadStages)
      .values(DEFAULT_LEAD_STAGES.map((s, i) => ({ ...s, position: i })))
      .returning();
    stageIds.open = created.filter((s) => s.kind === "open").map((s) => s.id);
    stageIds.won = created.find((s) => s.kind === "won")!.id;
    stageIds.lost = created.find((s) => s.kind === "lost")!.id;
  }
  if (!stageIds.won || !stageIds.lost || stageIds.open.length < 3) throw new Error("Lid bosqichlari to'liq emas");
  const stageOf = (n: number) => (n <= 2 ? stageIds.open[n]! : n === 3 ? stageIds.won! : stageIds.lost!);

  // 1. Guruhlar
  await insertAll(tx, groups, newGroupRows);
  await insertAll(tx, groupPrices, groupPriceRows);

  // 2. O'quvchilar (a'zolikdan keyingi holat bilan)
  const studentRows: (typeof students.$inferInsert)[] = stuList
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map((s) => {
      const open = s.mems.filter((m) => m.status !== "left");
      const status: "trial" | "active" | "paused" | "left" = open.some((m) => m.status === "active")
        ? "active"
        : open.some((m) => m.status === "paused")
          ? "paused"
          : open.some((m) => m.status === "trial")
            ? "trial"
            : "left";
      const lastLeft = [...s.mems].filter((m) => m.leftAt).sort((a, b) => b.leftAt!.localeCompare(a.leftAt!))[0];
      const parentMale = chance(0.5);
      const surname = s.name.split(" ")[1] ?? pick(SURNAMES);
      return {
        id: s.id,
        branchId: branch.id,
        name: s.name,
        phone: s.phone,
        parentName: s.kid
          ? `${pick(parentMale ? MALE : FEMALE)} ${parentMale ? surname.replace(/a$/, "") : `${surname.replace(/a$/, "")}a`}`
          : null,
        parentPhone: s.kid ? phone() : null,
        birthDate: s.kid
          ? `${int(2007, 2015)}-${pad(int(1, 12))}-${pad(int(1, 28))}`
          : `${int(1994, 2006)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
        gender: s.gender,
        school: s.kid ? `${int(1, 300)}-maktab` : null,
        grade: s.kid ? `${int(5, 11)}-sinf` : null,
        address: `Toshkent sh., ${pick(DISTRICTS)} tumani`,
        source: s.source,
        interestedCourseId: s.courseId,
        status,
        statusNote: status === "left" ? (lastLeft?.leftReason ?? null) : null,
        statusChangedAt: status === "left" && lastLeft ? past(lastLeft.leftAt!, 12) : null,
        joinedAt: s.joinedAt,
        createdBy: s.createdBy,
        ...stamp(past(s.joinedAt, int(9, 18), int(0, 59))),
      };
    });
  await insertAll(tx, students, studentRows);

  // 3. A'zolik, muzlatish, chegirma
  await insertAll(
    tx,
    groupMemberships,
    memList
      .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))
      .map((m) => ({
        id: m.id,
        groupId: m.g.id,
        studentId: m.stu.id,
        status: m.status,
        enrolledAt: m.enrolledAt,
        activatedAt: m.activatedAt,
        pausedAt: m.pausedAt,
        leftAt: m.leftAt,
        leftReason: m.leftReason,
        leftNote: m.leftNote,
        createdBy: staff.id,
        createdAt: past(m.enrolledAt, 11),
        updatedAt: past(m.leftAt ?? m.activatedAt ?? m.enrolledAt, 11),
      })),
  );
  await insertAll(
    tx,
    membershipPauses,
    memList.flatMap((m) =>
      m.pauses.map((p) => ({ membershipId: m.id, startDate: p.from, endDate: p.to, createdAt: past(p.from, 10) })),
    ),
  );
  await insertAll(
    tx,
    studentDiscounts,
    stuList
      .filter((s) => s.discount)
      .map((s) => ({
        studentId: s.id,
        groupId: null,
        kind: "percent" as const,
        value: s.discount!.percent,
        fromMonth: s.discount!.fromMonth,
        toMonth: null,
        affectsTeacher: s.discount!.affectsTeacher,
        reason: s.discount!.reason,
        createdBy: staff.id,
        ...stamp(past(`${s.discount!.fromMonth}-05`, 12)),
      })),
  );

  // 4. Davomat
  await insertAll(
    tx,
    attendance,
    memList.flatMap((m) =>
      m.marks.map((mk) => ({
        groupId: m.g.id,
        studentId: m.stu.id,
        date: mk.date,
        status: mk.status,
        reason: mk.reason,
        markedBy: staff.id,
        ...stamp(past(mk.date, 19, int(0, 59))),
      })),
    ),
    1000,
  );

  // 5. To'lovlar (chek raqami sana bo'yicha ketma-ket)
  const sortedPay = [...payPlans].sort((a, b) => a.date.localeCompare(b.date) || a.stu.id.localeCompare(b.stu.id));
  let receipt = maxReceipt;
  await insertAll(
    tx,
    payments,
    sortedPay.map((p) => {
      const at = past(p.date, int(9, 19), int(0, 59));
      const money = p.kind !== "discount";
      return {
        studentId: p.stu.id,
        groupId: p.m.g.id,
        kind: p.kind,
        amount: p.amount,
        month: p.month,
        date: p.date,
        methodId: money ? methodId(methodNames()) : null,
        receiptNo: p.kind === "payment" ? ++receipt : null,
        note: p.note,
        createdBy: staff.id,
        ...stamp(at),
      };
    }),
  );
  await insertAll(tx, studentNotes, noteRows);

  // 6. Xarajat, daromad, rejalar
  await insertAll(
    tx,
    expenses,
    expPlans.map((e) => ({
      branchId: branch.id,
      kind: e.kind,
      categoryId: catId("expense", e.cat),
      reason: e.reason,
      amount: e.amount,
      date: e.date,
      methodId: methodId(e.bank ? "Bank o'tkazmasi" : methodNames()),
      userId: e.who === "user" ? staff.id : null,
      teacherId: e.who === "teacher" ? pick(teacherRows).id : null,
      createdBy: staff.id,
      ...stamp(past(e.date, int(9, 18), int(0, 59))),
    })),
  );
  await insertAll(
    tx,
    additionalIncomes,
    incPlans.map((i) => ({
      branchId: branch.id,
      categoryId: catId("income", i.cat),
      title: i.title,
      amount: i.amount,
      date: i.date,
      methodId: methodId(methodNames()),
      payer: i.payer,
      createdBy: staff.id,
      ...stamp(past(i.date, int(9, 18), int(0, 59))),
    })),
  );

  // Xarajat rejasi: o'tgan oylar — haqiqiyga yaqin (ba'zi oylarda oshib ketgan), kelgusi oylar — oxirgi 3 oy o'rtachasi
  const PLAN_CATS = [
    "Ofis xarajatlari",
    "Reklama va marketing",
    "Kommunal to'lovlar",
    "Internet va aloqa",
    "Kantselyariya",
    "Choy va kofe / oshxona",
    "Jihozlar va texnika",
    "Dasturiy ta'minot",
  ];
  const actualOf = (cat: string, month: string) =>
    expPlans.filter((e) => e.cat === cat && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const planMonths = monthsBetween(START.slice(0, 7), "2026-12");
  const planRows: (typeof expensePlans.$inferInsert)[] = [];
  for (const month of planMonths) {
    for (const cat of PLAN_CATS) {
      const recent = [1, 2, 3].map((n) => actualOf(cat, addMonths(CUR_MONTH, -n)));
      const avg = recent.reduce((s, v) => s + v, 0) / 3;
      const base = month < CUR_MONTH ? actualOf(cat, month) : avg;
      const amount = Math.max(
        100_000,
        round(base * (month < CUR_MONTH ? between(0.8, 1.15) : between(0.95, 1.1)), 100_000),
      );
      planRows.push({
        branchId: branch.id,
        categoryId: catId("expense", cat),
        month,
        amount,
        createdBy: staff.id,
        ...stamp(past(`${addMonths(month, -1)}-25`, 12)),
      });
    }
  }
  await insertAll(tx, expensePlans, planRows);

  // 7. Maosh
  await insertAll(
    tx,
    salaryEntries,
    salPlans.map((s) => ({
      teacherId: s.teacherId,
      kind: s.kind,
      amount: s.amount,
      month: s.month,
      date: s.date,
      methodId: methodId(
        weighted([
          ["Naqd pul", 40],
          ["Plastik karta", 45],
          ["Bank o'tkazmasi", 15],
        ] as const),
      ),
      createdBy: staff.id,
      ...stamp(past(s.date, 15)),
    })),
  );

  // 8. Pul oqimi rejasi — 2026 ning har oyi
  const sumBy = (rows: { month: string; amount: number }[], month: string) =>
    rows.filter((r) => r.month === month).reduce((s, r) => s + r.amount, 0);
  const payRows = sortedPay
    .filter((p) => p.kind === "payment")
    .map((p) => ({ month: p.date.slice(0, 7), amount: p.amount }));
  const incRows = incPlans.map((i) => ({ month: i.date.slice(0, 7), amount: i.amount }));
  const salRows = salPlans.map((s) => ({ month: s.month, amount: s.amount }));
  const planFor = (rows: { month: string; amount: number }[], month: string, fallback: number) => {
    if (month < CUR_MONTH) return Math.max(fallback, round(sumBy(rows, month) * between(0.9, 1.15), 1_000_000));
    const avg = [1, 2, 3].reduce((s, n) => s + sumBy(rows, addMonths(CUR_MONTH, -n)), 0) / 3;
    return Math.max(fallback, round(avg * between(1.0, 1.1), 1_000_000));
  };
  const fpRows: (typeof financePlans.$inferInsert)[] = [];
  for (const month of monthsBetween("2026-01", "2026-12")) {
    const at = past(`${addMonths(month, -1)}-28`, 12);
    fpRows.push({
      branchId: branch.id,
      month,
      line: "payments",
      amount: planFor(payRows, month, 10_000_000),
      createdBy: staff.id,
      ...stamp(at),
    });
    fpRows.push({
      branchId: branch.id,
      month,
      line: "income",
      amount: planFor(incRows, month, 1_000_000),
      createdBy: staff.id,
      ...stamp(at),
    });
    fpRows.push({
      branchId: branch.id,
      month,
      line: "salary",
      amount: planFor(salRows, month, 3_000_000),
      createdBy: staff.id,
      ...stamp(at),
    });
  }
  await insertAll(tx, financePlans, fpRows);

  // 9. Lidlar, bosqich tarixi, birinchi darslar
  const leadIds = leadPlans.map(() => randomUUID());
  await insertAll(
    tx,
    leads,
    leadPlans.map((p, i) => {
      const last = p.events.at(-1)!;
      const lostFrom = p.want === "lost" ? stageOf(p.events.at(-2)?.stage ?? 0) : null;
      return {
        id: leadIds[i]!,
        branchId: branch.id,
        name: p.name,
        phone: p.phone,
        gender: p.gender,
        source: p.source,
        courseId: p.courseId,
        stageId: stageOf(last.stage),
        assignedTo: p.assignedTo,
        targetDate: p.targetDate,
        note: p.note,
        stageChangedAt: last.at,
        studentId: p.want === "won" ? p.stu!.id : null,
        lostReason: p.want === "lost" ? p.lostReason : null,
        lostNote: p.want === "lost" ? p.lostNote : null,
        lostFromStageId: lostFrom,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: last.at,
      };
    }),
  );
  await insertAll(
    tx,
    leadEvents,
    leadPlans.flatMap((p, i) =>
      p.events.map((e, k) => ({
        leadId: leadIds[i]!,
        fromStageId: k === 0 ? null : stageOf(p.events[k - 1]!.stage),
        toStageId: stageOf(e.stage),
        actorId: p.assignedTo,
        actorName: p.assignedTo ? staff.name : null,
        at: e.at,
      })),
    ),
  );
  await insertAll(
    tx,
    leadFirstLessons,
    firstLessons.map((f) => ({
      leadId: leadIds[leadPlans.indexOf(f.p)]!,
      groupId: f.group.id,
      lessonDate: f.date,
      status: f.status,
      createdBy: staff.id,
      markedBy: staff.id,
      markedAt: past(f.date, 20, 30),
      ...stamp(f.p.events.find((e) => e.stage === 2)!.at),
    })),
  );

  await tx.insert(settings).values({ key: MARKER, value: { at: NOW.toISOString(), from: START, to: TODAY } });
});

/* ===================== Xulosa ===================== */

const tables = [
  "groups",
  "students",
  "group_memberships",
  "membership_pauses",
  "attendance",
  "payments",
  "student_discounts",
  "student_notes",
  "expenses",
  "expense_plans",
  "additional_incomes",
  "salary_entries",
  "finance_plans",
  "leads",
  "lead_events",
  "lead_first_lessons",
];
for (const t of tables) {
  const rows = (await db.execute(sql.raw(`select count(*)::int as n from ${t}`))) as unknown as { n: number }[];
  console.log(`${t.padEnd(20)} ${rows[0]!.n}`);
}
const by = (await db.execute(
  sql`select s.kind, count(*)::int as n from leads l join lead_stages s on s.id = l.stage_id group by s.kind order by s.kind`,
)) as unknown as { kind: string; n: number }[];
console.log(`lidlar holati: ${by.map((r) => `${r.kind}=${r.n}`).join(", ")}`);
await db.close();
done(`${tenant.name}: ${START} … ${TODAY} oralig'idagi namuna tarix qo'shildi`);

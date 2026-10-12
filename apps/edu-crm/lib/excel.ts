/*
 * Excel import yordamchilari (EDU-CRM-PLAN E1e, ADR 0013). Client (ustunlarni aniqlash) va server (tekshirish)
 * ikkalasida ishlatiladi — server importi yo'q. Eski tizimdagi qoidalar asosida, lekin xatolarsiz:
 * telefon faqat to'g'ri formatda, narxdagi kasr ajratkichi raqamga qo'shilmaydi, sana UTC siljishisiz.
 */

export type ImportTable = "students" | "groups" | "teachers";
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  /** Sarlavhani aniqlash (kichik harf, apostrofsiz) */
  match: RegExp;
}

/** Sarlavha matnini solishtirish uchun: kichik harf, turli apostroflar bitta */
export const normHeader = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .trim();

/** Ism solishtirish: kichik harf, ortiqcha bo'shliqsiz, apostrofsiz */
export const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ‘’`´']/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Telefon: 9 ta raqam (mahalliy) yoki null. "+998 90 123-45-67", "998901234567", "0901234567", "901234567" */
export function parsePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 9) return d;
  if (d.length === 12 && d.startsWith("998")) return d.slice(3);
  if (d.length === 10 && d.startsWith("0")) return d.slice(1);
  return null;
}

/** Sana: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY yoki Excel seriya raqami → YYYY-MM-DD; noto'g'ri bo'lsa null */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)))
    [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    // Excel seriya raqami (1900 tizimi): 1 = 1900-01-01, 60 — mavjud bo'lmagan 1900-02-29
    const serial = Math.floor(Number(s));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Pul: "390 000", "390,000", "390000.50 so'm" → 390000 (kasr qismi tashlanadi); bo'sh — null */
export function parseMoney(raw: string): number | null {
  const s = raw.replace(/so'?m|sum|uzs/gi, "").trim();
  if (!s) return null;
  // Oxirgi ajratkichdan keyin 1–2 raqam bo'lsa — kasr qismi
  const cleaned = s.replace(/[.,](\d{1,2})$/, "").replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

const DAY_PREFIX: [RegExp, string][] = [
  [/^(du|mon)/, "mon"],
  [/^(se|tue)/, "tue"],
  [/^(cho|wed)/, "wed"],
  [/^(pa|thu)/, "thu"],
  [/^(ju|fri)/, "fri"],
  [/^(sh|sat)/, "sat"],
  [/^(ya|sun)/, "sun"],
];
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "Du, Chor, Jum", "toq", "juft", "Mon/Wed/Fri" → ["mon","wed","fri"]; tanilmagan so'z bo'lsa null */
export function parseDays(raw: string): string[] | null {
  const s = normHeader(raw);
  if (!s) return null;
  if (/^toq/.test(s)) return ["mon", "wed", "fri"];
  if (/^juft/.test(s)) return ["tue", "thu", "sat"];
  const out = new Set<string>();
  for (const part of s.split(/[\s,;/|-]+/).filter(Boolean)) {
    const hit = DAY_PREFIX.find(([re]) => re.test(part));
    if (!hit) return null;
    out.add(hit[1]);
  }
  return out.size ? WEEK.filter((d) => out.has(d)) : null;
}

/** "14:00 - 16:00", "14.00-16.00", "9:00" → { start, end } (end bo'lmasa +90 daqiqa) */
export function parseTimeRange(raw: string): { start: string; end: string } | null {
  const times = [...raw.matchAll(/(\d{1,2})[:.](\d{2})/g)].map(([, h, m]) => [Number(h), Number(m)] as const);
  const fmt = ([h, m]: readonly [number, number]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ok = ([h, m]: readonly [number, number]) => h < 24 && m < 60;
  const [a, b] = times;
  if (!a || !ok(a)) return null;
  if (b && ok(b)) return fmt(b) > fmt(a) ? { start: fmt(a), end: fmt(b) } : null;
  const total = Math.min(a[0] * 60 + a[1] + 90, 23 * 60 + 59);
  return { start: fmt(a), end: fmt([Math.floor(total / 60), total % 60]) };
}

/* ---------- Ustunlar ---------- */

export const FIELDS: Record<ImportTable, FieldDef[]> = {
  students: [
    { key: "name", label: "O'quvchi F.I.SH", required: true, match: /f\.?i\.?sh|fio|ism|familiya|name/ },
    {
      key: "phone",
      label: "Telefon raqami",
      required: true,
      match: /^(?!.*(ota|ona|parent|qo'shimcha)).*(tel|phone|raqam|aloqa|number)/,
    },
    { key: "parentPhone", label: "Ota-onasi raqami", match: /(ota|ona|parent).*(tel|phone|raqam)|ota-ona tel/ },
    { key: "parentName", label: "Ota-onasi ismi", match: /(ota|ona|parent).*(ism|name)/ },
    { key: "birthDate", label: "Tug'ilgan sana", match: /birth|tug'il/ },
    { key: "address", label: "Manzil", match: /address|manzil/ },
    { key: "group", label: "Guruh nomi", match: /guruh|group/ },
    { key: "joinedAt", label: "Qo'shilgan sana", match: /qo'shil|joined|sana|date/ },
    { key: "grade", label: "Sinfi / Daraja", match: /sinf|daraja|grade|level|class/ },
    { key: "source", label: "Manba", match: /manba|source|qayerdan/ },
    { key: "note", label: "Izoh", match: /izoh|note|comment|tavsif/ },
  ],
  groups: [
    { key: "name", label: "Guruh nomi", required: true, match: /guruh|group|^nomi|^name/ },
    { key: "course", label: "Kurs nomi", required: true, match: /kurs|course/ },
    { key: "teacher", label: "O'qituvchi F.I.SH", required: true, match: /o'qituvchi|ustoz|teacher|pedagog/ },
    { key: "days", label: "Dars kunlari (Du, Chor, Jum)", required: true, match: /kun|days/ },
    { key: "time", label: "Dars vaqti (14:00 - 16:00)", required: true, match: /vaqt|time/ },
    { key: "room", label: "Xona", match: /xona|room/ },
    { key: "startDate", label: "Boshlanish sanasi", match: /boshlan|start/ },
    { key: "price", label: "Oylik to'lov summasi", match: /narx|to'lov|price|summa|cost/ },
  ],
  teachers: [
    { key: "name", label: "O'qituvchi F.I.SH", required: true, match: /f\.?i\.?sh|fio|ism|familiya|name/ },
    { key: "phone", label: "Telefon raqami", required: true, match: /tel|phone|raqam|aloqa|number/ },
    { key: "birthDate", label: "Tug'ilgan sana", match: /birth|tug'il/ },
    { key: "salary", label: "Maosh (masalan: 40 [Foiz])", match: /maosh|salary|ish haqi/ },
    { key: "percent", label: "Foiz stavkasi (%)", match: /foiz|percent|%/ },
    { key: "note", label: "Izoh / Malaka", match: /izoh|note|malaka|comment/ },
  ],
};

/** Sarlavhalar bo'yicha ustun → maydon (har maydon bir marta); topilmasa — bo'sh */
export function detectColumns(table: ImportTable, headers: string[]): string[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const n = normHeader(h);
    if (!n) return "";
    const f = FIELDS[table].find((x) => !used.has(x.key) && x.match.test(n));
    if (!f) return "";
    used.add(f.key);
    return f.key;
  });
}

/** O'qituvchi maoshi: "40", "40 [Foiz]", "3 000 000 [Fiks]", "50 000 [O'quvchi]" */
export function parseSalary(raw: string): { type: "percent" | "per_student" | "fixed"; value: number } | null {
  const s = normHeader(raw);
  if (!s) return null;
  const type = /fiks|fix|belgilan|oylik/.test(s)
    ? "fixed"
    : /o'quvchi|student|talaba/.test(s)
      ? "per_student"
      : "percent";
  const value = parseMoney(s.replace(/\[.*?\]|%/g, ""));
  if (value === null) return null;
  if (type === "percent" && value > 100) return null;
  return { type, value };
}

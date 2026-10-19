import { formatDate, money } from "@/lib/format";

/*
 * Faoliyat jurnali reyestri (E6c, ADR 0037): audit amal kaliti → bo'lim + o'zbekcha jumla. Kalitlar kodda
 * ctx.audit va tenantAudit.record orqali yoziladi; reyestrda yo'g'i bo'lsa jumla umumiy ko'rinishda
 * chiqadi (jurnal yozuvi yo'qolmaydi), lekin Vitest kodda uchragan har kalit reyestrda borligini tekshiradi.
 * Sof modul: baza va server kodiga tegmaydi.
 */

export const ACTIVITY_SECTIONS = [
  "student",
  "group",
  "teacher",
  "staff",
  "lead",
  "payment",
  "finance",
  "attendance",
  "settings",
  "import",
  "approval",
  "auth",
  "other",
] as const;
export type ActivitySection = (typeof ACTIVITY_SECTIONS)[number];

export const SECTION_LABELS: Record<ActivitySection, string> = {
  student: "O'quvchilar",
  group: "Guruhlar",
  teacher: "O'qituvchilar",
  staff: "Xodimlar va lavozimlar",
  lead: "Lidlar",
  payment: "To'lovlar",
  finance: "Xarajat, daromad, ish haqi",
  attendance: "Davomat",
  settings: "Kurslar va sozlamalar",
  import: "Excel import",
  approval: "Tasdiqlar",
  auth: "Kirish va hisob",
  other: "Boshqa",
};

type Meta = Record<string, unknown>;

/** Jumla uchun kirish: metadata, nishon nomi (bazadan) va nishon id si */
export interface SentenceInput {
  m: Meta;
  who: string | null;
  targetId: string | null;
}

interface Def {
  section: ActivitySection;
  text(i: SentenceInput): string;
  /** Boshqa yozuvning aksi (masalan student.enroll — group.enroll ning ikkinchi tomoni): ro'yxatda ikki marta chiqmasin */
  mirror?: true;
}

/* ---------- Kichik yordamchilar ---------- */

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Meta | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : null);
const som = (n: number) => `${money(n)} so'm`;
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? formatDate(s.slice(0, 10)) : s;
};
const amountOf = (m: Meta): number | null =>
  num(m.amount) ?? num(obj(m.after)?.amount) ?? num(obj(m.before)?.amount) ?? null;
/** Nishon nomi: metadata'dagi `name`, bo'lmasa bazadan topilgani */
const nameOf = (i: SentenceInput) => str(i.m.name) ?? i.who;
const parts = (...p: (string | null | false | undefined)[]) => p.filter(Boolean).join(", ") || null;

/** "<bosh>: <tafsilot> — <kim>" */
function line(head: string, detail?: string | null, who?: string | null) {
  return `${head}${detail ? `: ${detail}` : ""}${who ? ` — ${who}` : ""}`;
}

const STUDENT_STATUS: Record<string, string> = {
  trial: "sinovda",
  active: "faol",
  paused: "muzlatilgan",
  left: "chiqib ketgan",
  returned: "qaytgan",
  graduated: "bitirgan",
};
const LESSON_STATUS: Record<string, string> = {
  present: "keldi",
  late: "kech qoldi",
  excused: "sababli",
  absent: "kelmadi",
};
const SALARY_KIND: Record<string, string> = { salary: "ish haqi", advance: "avans", bonus: "bonus", penalty: "jarima" };
const IMPORT_TABLE: Record<string, string> = {
  students: "o'quvchi",
  groups: "guruh",
  teachers: "o'qituvchi",
  leads: "lid",
};

const statusPair = (m: Meta, map: Record<string, string>) => {
  const from = str(m.from);
  const to = str(m.to);
  if (!to) return null;
  return from ? `${map[from] ?? from} → ${map[to] ?? to}` : (map[to] ?? to);
};

/** Oddiy yozuv: bosh, ixtiyoriy tafsilot, nishon nomi */
function simple(
  section: ActivitySection,
  head: string,
  detail?: (i: SentenceInput) => string | null,
  who?: (i: SentenceInput) => string | null,
  mirror?: true,
): Def {
  return { section, mirror, text: (i) => line(head, detail?.(i), who ? who(i) : nameOf(i)) };
}

const reason = (i: SentenceInput) => str(i.m.reason) ?? str(i.m.voidReason);
/** Amal bilan birga berilgan yoki olingan coin (ADR 0061): `coins` — ro'yxat yoki ommaviy amalda bitta yozuv */
const coinText = (i: SentenceInput): string | null => {
  const list = Array.isArray(i.m.coins) ? i.m.coins : i.m.coins ? [i.m.coins] : [];
  const out = list.flatMap((c) => {
    const o = obj(c);
    const amount = num(o?.amount);
    if (!o || amount === null) return [];
    return [`${o.action === "revoke" ? "−" : "+"}${money(amount)} coin`];
  });
  return out.length ? out.join(", ") : null;
};
const groupOf = (i: SentenceInput) => str(i.m.group);
const studentOf = (i: SentenceInput) => str(i.m.student);

/** Excel import bilan qo'shilgan bo'lsa bosh o'zgaradi */
const created = (section: ActivitySection, head: string, importHead: string): Def => ({
  section,
  text: (i) => line(i.m.import === true ? importHead : head, null, nameOf(i)),
});

const money2 = (head: string, extra?: (i: SentenceInput) => string | null): Def["text"] => {
  return (i) => {
    const a = amountOf(i.m);
    return line(head, parts(a !== null && som(a), extra?.(i)), i.who);
  };
};

/* ---------- Reyestr ---------- */

const REGISTRY: Record<string, Def> = {
  // O'quvchilar
  "student.create": created("student", "yangi o'quvchi qo'shdi", "Excel'dan o'quvchi qo'shdi"),
  "student.update": simple("student", "o'quvchi ma'lumotini tahrirladi"),
  "student.status": simple("student", "o'quvchi holatini o'zgartirdi", (i) =>
    parts(statusPair(i.m, STUDENT_STATUS), reason(i)),
  ),
  "student.transfer": simple("student", "o'quvchini boshqa filialga o'tkazdi", reason),
  "student.archive": simple("student", "o'quvchini arxivga oldi", reason),
  "student.restore": simple("student", "o'quvchini arxivdan tikladi"),
  "student.purge": simple("student", "o'quvchini butunlay o'chirdi", reason),
  "student.note.create": simple("student", "o'quvchiga eslatma qo'shdi"),
  "student.note.delete": simple("student", "o'quvchining eslatmasini o'chirdi", (i) => str(i.m.text)),
  "student.enroll": simple("student", "o'quvchini guruhga qo'shdi", groupOf, (i) => i.who, true),
  "student.activate": simple("student", "o'quvchini guruhda faollashtirdi", groupOf, (i) => i.who, true),
  "student.pause": simple("student", "o'quvchini guruhda muzlatdi", groupOf, (i) => i.who, true),
  "student.unpause": simple("student", "o'quvchining muzlatilishini bekor qildi", groupOf, (i) => i.who, true),
  "student.leave": simple(
    "student",
    "o'quvchini guruhdan chiqardi",
    (i) => parts(groupOf(i), reason(i), i.m.forgiven ? "qarzdan kechib" : i.m.auto ? "qarzi to'langach" : null),
    (i) => i.who,
    true,
  ),
  "student.leave_pending": simple(
    "student",
    "o'quvchini qarz to'languncha muzlatdi (keyin guruhdan chiqadi)",
    (i) => parts(groupOf(i), reason(i)),
    (i) => i.who,
    true,
  ),

  // Guruhlar
  "group.create": created("group", "yangi guruh ochdi", "Excel'dan guruh qo'shdi"),
  "group.update": simple("group", "guruhni tahrirladi", (i) => (obj(i.m.price) ? "narx o'zgardi" : null)),
  "group.archive": simple("group", "guruhni arxivga oldi"),
  "group.restore": simple("group", "guruhni arxivdan tikladi"),
  "group.enroll": simple("group", "guruhga o'quvchi qo'shdi", studentOf),
  "group.activate": simple("group", "guruhda o'quvchini faollashtirdi", studentOf),
  "group.pause": simple("group", "guruhda o'quvchini muzlatdi", studentOf),
  "group.unpause": simple("group", "guruhda o'quvchining muzlatilishini bekor qildi", studentOf),
  "group.leave": simple("group", "guruhdan o'quvchini chiqardi", (i) =>
    parts(studentOf(i), reason(i), i.m.forgiven ? "qarzdan kechib" : i.m.auto ? "qarzi to'langach" : null),
  ),
  "group.leave_pending": simple("group", "o'quvchini qarz to'languncha muzlatdi (keyin guruhdan chiqadi)", (i) =>
    parts(studentOf(i), reason(i)),
  ),

  // O'qituvchilar
  "teacher.create": created("teacher", "yangi o'qituvchi qo'shdi", "Excel'dan o'qituvchi qo'shdi"),
  "teacher.update": simple("teacher", "o'qituvchi ma'lumotini tahrirladi"),
  "teacher.archive": simple("teacher", "o'qituvchini arxivga oldi"),
  "teacher.restore": simple("teacher", "o'qituvchini arxivdan tikladi"),

  // Xodimlar va lavozimlar
  "staff.create": simple("staff", "yangi xodim qo'shdi"),
  "staff.update": simple("staff", "xodim ma'lumotini tahrirladi"),
  "staff.archive": simple("staff", "xodimni bo'shatdi"),
  "staff.restore": simple("staff", "xodimni arxivdan tikladi"),
  "staff.lock": simple("staff", "xodim hisobini blokladi"),
  "staff.unlock": simple("staff", "xodim hisobini blokdan chiqardi"),
  "staff.reset_password": simple("staff", "xodimga yangi vaqtinchalik parol berdi"),
  "staff.reset_telegram": simple("staff", "xodimning Telegram ulanishini tiklab yubordi"),
  "position.create": simple("staff", "yangi lavozim yaratdi", (i) => (str(i.m.clonedFrom) ? "nusxa" : null)),
  "position.update": simple("staff", "lavozimni tahrirladi"),
  "position.delete": simple("staff", "lavozimni o'chirdi"),

  // Lidlar
  "lead.create": created("lead", "yangi lid qo'shdi", "Excel'dan lid qo'shdi"),
  "lead.update": simple("lead", "lid ma'lumotini tahrirladi"),
  "lead.stage": simple("lead", "lidni boshqa bosqichga o'tkazdi", (i) =>
    str(i.m.from) && str(i.m.to) ? `${str(i.m.from)} → ${str(i.m.to)}` : null,
  ),
  "lead.assign": simple("lead", "lidni xodimga biriktirdi", (i) => str(i.m.to)),
  "lead.archive": simple("lead", "lidni arxivga oldi", reason),
  "lead.restore": simple("lead", "lidni qayta ochdi", (i) => str(i.m.to)),
  "lead.unarchive": simple("lead", "lidni arxivdan tikladi"),
  "lead.note": simple("lead", "lidga yozuv qo'shdi"),
  "lead.note.delete": simple("lead", "lidning yozuvini o'chirdi", (i) => str(i.m.text)),
  "lead.lose": simple("lead", "lidni yo'qotilganlarga o'tkazdi", reason),
  "lead.convert": simple("lead", "lidni o'quvchiga aylantirdi", (i) => str(i.m.group)),
  "lead.first_lesson": simple("lead", "birinchi darsga yozdi", (i) => day(i.m.date) ?? str(i.m.group)),
  "lead.first_lesson.cancel": simple("lead", "birinchi darsni bekor qildi", (i) => day(i.m.date)),
  "lead.first_lesson.mark": simple("lead", "birinchi dars natijasini belgiladi"),
  "lead.waitlist": simple("lead", "lidni kutish ro'yxatiga qo'shdi", (i) => str(i.m.waitlist)),
  "lead.waitlist.create": simple("lead", "kutish ro'yxati ochdi"),
  "lead.waitlist.update": simple("lead", "kutish ro'yxatini tahrirladi"),
  "lead.waitlist.close": simple("lead", "kutish ro'yxatini yopdi"),
  "lead.waitlist.activate": simple("lead", "kutish ro'yxatidagi lidni faollashtirdi"),
  "lead.apply": simple("lead", "saytdan ariza qoldirdi", (i) => (i.m.repeat === true ? "takroriy ariza" : null)),

  // To'lovlar
  "payment.create": {
    section: "payment",
    text: money2("to'lov qabul qildi", (i) =>
      parts(num(i.m.discount) ? `chegirma ${som(num(i.m.discount)!)}` : null, coinText(i)),
    ),
  },
  "payment.update": simple(
    "payment",
    "to'lovni tahrirladi",
    (i) => parts(str(i.m.receiptNo) ? `№${str(i.m.receiptNo)}` : null, coinText(i)),
    (i) => i.who,
  ),
  "payment.refund": { section: "payment", text: money2("to'lovni qaytardi", reason) },
  "payment.correction": { section: "payment", text: money2("o'quvchi balansini tuzatdi", reason) },
  "payment.writeoff": { section: "payment", text: money2("guruhdan chiqarishda qarzdan kechdi") },
  "payment.void": { section: "payment", text: money2("to'lovni bekor qildi", (i) => parts(reason(i), coinText(i))) },
  "payment.restore": { section: "payment", text: money2("bekor qilingan to'lovni tikladi", coinText) },
  "discount.create": simple("payment", "chegirma berdi", discountText, (i) => i.who),
  "discount.update": simple("payment", "chegirmani o'zgartirdi", undefined, (i) => i.who),
  "discount.delete": simple("payment", "chegirmani o'chirdi", discountText, (i) => i.who),
  "payment_method.create": simple("payment", "yangi to'lov usuli qo'shdi"),
  "payment_method.update": simple(
    "payment",
    "to'lov usulini o'zgartirdi",
    undefined,
    (i) => str(obj(i.m.after)?.name) ?? i.who,
  ),
  "finance_settings.update": simple("payment", "moliya sozlamalarini o'zgartirdi", undefined, () => null),
  "coin_settings.update": simple("settings", "coin qoidalarini o'zgartirdi", undefined, () => null),
  "grading_settings.update": simple(
    "settings",
    "baholash shkalasini o'zgartirdi",
    (i) => (num(obj(i.m.after)?.scale) ? `${num(obj(i.m.after)?.scale)} ballik` : null),
    () => null,
  ),

  // Xarajat, daromad, ish haqi
  "expense.create": { section: "finance", text: money2("xarajat kiritdi") },
  "expense.update": { section: "finance", text: money2("xarajatni tahrirladi") },
  "expense.void": { section: "finance", text: money2("xarajatni bekor qildi", reason) },
  "expense.restore": { section: "finance", text: money2("xarajatni tikladi") },
  "expense_plan.create": { section: "finance", text: money2("xarajat rejasi qo'shdi", (i) => str(i.m.month)) },
  "expense_plan.update": { section: "finance", text: money2("xarajat rejasini o'zgartirdi", (i) => str(i.m.month)) },
  "expense_plan.delete": { section: "finance", text: money2("xarajat rejasini o'chirdi", (i) => str(i.m.month)) },
  "finance_category.create": simple("finance", "yangi moliya toifasi qo'shdi"),
  "finance_category.update": simple("finance", "moliya toifasini o'zgartirdi"),
  "finance_category.delete": simple("finance", "moliya toifasini o'chirdi"),
  "additional_income.create": { section: "finance", text: money2("qo'shimcha daromad kiritdi", (i) => str(i.m.title)) },
  "additional_income.update": {
    section: "finance",
    text: money2("qo'shimcha daromadni tahrirladi", (i) => str(obj(i.m.after)?.title)),
  },
  "additional_income.void": {
    section: "finance",
    text: money2("qo'shimcha daromadni bekor qildi", (i) => parts(str(i.m.title), reason(i))),
  },
  "additional_income.restore": {
    section: "finance",
    text: money2("qo'shimcha daromadni tikladi", (i) => str(i.m.title)),
  },
  "salary_entry.create": { section: "finance", text: money2("ish haqi yozuvi kiritdi", salaryDetail) },
  "salary_entry.update": { section: "finance", text: money2("ish haqi yozuvini tahrirladi", salaryDetail) },
  "salary_entry.void": {
    section: "finance",
    text: money2("ish haqi yozuvini bekor qildi", (i) => parts(salaryDetail(i), reason(i))),
  },
  "salary_entry.restore": { section: "finance", text: money2("ish haqi yozuvini tikladi", salaryDetail) },

  // Davomat
  "attendance.mark": simple(
    "attendance",
    "o'quvchi davomatini belgiladi",
    (i) => parts(groupOf(i), day(i.m.date), LESSON_STATUS[str(i.m.to) ?? ""] ?? str(i.m.to), coinText(i)),
    (i) => i.who,
  ),
  "grade.mark": simple(
    "attendance",
    "dars bahosini qo'ydi",
    (i) => {
      const to = obj(i.m.to);
      const score = num(to?.score);
      const hw = to?.homework;
      return parts(
        groupOf(i),
        day(i.m.date),
        to ? null : "tozalandi",
        score !== null && `baho ${score}/${num(to?.scale) ?? "?"}`,
        hw === true ? "uy vazifasi bajarildi" : hw === false ? "uy vazifasi bajarilmadi" : null,
        coinText(i),
      );
    },
    (i) => i.who,
  ),
  "attendance.mark_all": simple(
    "attendance",
    "guruh davomatini belgiladi",
    (i) => parts(day(i.m.date), num(i.m.marked) !== null && `${num(i.m.marked)} ta o'quvchi`, coinText(i)),
    (i) => groupOf(i) ?? i.who,
  ),
  "employee_attendance.mark": simple("attendance", "xodim davomatini belgiladi", (i) =>
    parts(day(i.m.date), { present: "keldi", late: "kech qoldi", absent: "kelmadi" }[str(i.m.to) ?? ""] ?? str(i.m.to)),
  ),
  "employee_attendance.mark_all": simple(
    "attendance",
    "xodimlar davomatini belgiladi",
    (i) => parts(day(i.targetId), num(i.m.marked) !== null && `${num(i.m.marked)} ta`),
    () => null,
  ),

  // Kurslar va sozlamalar
  "course.create": simple("settings", "yangi kurs qo'shdi"),
  "course.update": simple("settings", "kursni tahrirladi", undefined, (i) => str(obj(i.m.after)?.name) ?? i.who),
  "course.archive": simple("settings", "kursni arxivga oldi"),
  "course.restore": simple("settings", "kursni arxivdan tikladi"),
  "room.create": simple("settings", "yangi xona qo'shdi"),
  "room.update": simple("settings", "xonani tahrirladi", undefined, (i) => str(obj(i.m.after)?.name) ?? i.who),
  "room.delete": simple("settings", "xonani o'chirdi"),
  "holiday.create": simple("settings", "dam olish kuni qo'shdi", (i) => day(i.m.startDate)),
  "holiday.update": simple("settings", "dam olish kunini tahrirladi", (i) => day(i.m.startDate)),
  "holiday.delete": simple("settings", "dam olish kunini o'chirdi", (i) => day(i.m.startDate)),
  "branch.create": simple("settings", "yangi filial qo'shdi"),
  "branch.update": simple("settings", "filialni tahrirladi"),
  "branch.delete": simple("settings", "filialni o'chirdi"),
  "settings.update": simple(
    "settings",
    "sozlamani o'zgartirdi",
    (i) => SETTING_LABEL[i.targetId ?? ""] ?? null,
    () => null,
  ),
  // SMS (docs/EDU-CRM-SMS.md): kalit jurnalga yozilmaydi — faqat email, soatlar va test raqami
  "sms.connect": simple(
    "settings",
    "Eskiz'ni uladi",
    (i) => str(i.m.after),
    () => null,
  ),
  "sms.disconnect": simple(
    "settings",
    "Eskiz'ni uzdi",
    (i) => str(i.m.email),
    () => null,
  ),
  "sms.settings": simple("settings", "SMS sozlamalarini o'zgartirdi", undefined, () => null),
  "sms.send": simple(
    "settings",
    "SMS yubordi",
    (i) => parts(str(i.m.title), num(i.m.queued) !== null ? `${num(i.m.queued)} ta` : null),
    () => null,
  ),
  "sms.mode": simple(
    "settings",
    "SMS rejimini o'zgartirdi",
    (i) => (str(i.m.after) === "own" ? "o'z Eskiz hisobi" : "Ventura paketi"),
    () => null,
  ),
  "sms.purchase": simple("settings", "SMS paket so'radi", undefined, () => null),
  "sms.test": simple(
    "settings",
    "test SMS yubordi",
    (i) => str(i.m.phone),
    () => null,
  ),
  "sms_template.create": simple(
    "settings",
    "SMS shablon qo'shdi",
    (i) => str(i.m.name),
    () => null,
  ),
  "sms_template.update": simple(
    "settings",
    "SMS shablonni tahrirladi",
    (i) => str(i.m.name),
    () => null,
  ),
  "sms_template.archive": simple(
    "settings",
    "SMS shablonni o'chirdi",
    (i) => str(i.m.name),
    () => null,
  ),
  "sms_template.submit": simple(
    "settings",
    "SMS shablonni moderatsiyaga yubordi",
    (i) => str(i.m.name),
    () => null,
  ),
  "sms_template.presets": simple("settings", "tayyor SMS andozalarni qo'shdi", undefined, () => null),
  "finance_opening_balance.update": simple("settings", "boshlang'ich kapitalni o'zgartirdi", undefined, () => null),
  "finance_plan.update": simple(
    "settings",
    "moliyaviy rejani o'zgartirdi",
    (i) => (num(i.m.year) !== null ? `${num(i.m.year)}-yil` : null),
    (i) => i.who,
  ),

  // Excel import
  "import.students": importDef("students"),
  "import.groups": importDef("groups"),
  "import.teachers": importDef("teachers"),
  "import.leads": importDef("leads"),

  // Tasdiqlar
  "approval.request": simple(
    "approval",
    "tasdiqlash uchun so'rov yubordi",
    (i) => str(i.m.title),
    () => null,
  ),
  "approval.approve": simple(
    "approval",
    "so'rovni tasdiqladi",
    (i) => str(i.m.title),
    () => null,
  ),
  "approval.reject": simple(
    "approval",
    "so'rovni rad etdi",
    (i) => str(i.m.note),
    () => null,
  ),
  "approval.cancel": simple("approval", "o'z so'rovini bekor qildi", undefined, () => null),
  "approval.fail": simple(
    "approval",
    "tasdiqlangan amal bajarilmadi",
    (i) => str(i.m.error),
    () => null,
  ),

  // Kirish va hisob
  "auth.login": simple(
    "auth",
    "tizimga kirdi",
    (i) => (i.m.newDevice === true ? "yangi qurilmadan" : null),
    () => null,
  ),
  "auth.logout": simple("auth", "tizimdan chiqdi", undefined, () => null),
  "auth.failed": simple(
    "auth",
    "kirishda xato kiritdi",
    (i) => ({ password: "parol", otp: "tasdiqlash kodi" })[str(i.m.reason) ?? ""] ?? str(i.m.reason),
    () => null,
  ),
  "auth.locked": simple("auth", "hisobi xato urinishlar sababli bloklandi", undefined, () => null),
  "auth.login_blocked": simple("auth", "bloklangan qurilmadan kirishga urindi", undefined, () => null),
  // Qurilmalar (E6g): nishon — qurilma egasi
  "device.block": simple("auth", "qurilmani blokladi", (i) => str(i.m.device)),
  "device.unblock": simple("auth", "qurilmani blokdan chiqardi", (i) => str(i.m.device)),
  "user.sessions_ended": simple(
    "auth",
    "boshqa seanslarini yopdi",
    (i) => {
      const n = num(i.m.count);
      return n !== null ? `${n} ta` : null;
    },
    () => null,
  ),
  "user.create": simple("auth", "hisob yaratildi", undefined, () => null),
  "user.telegram_linked": simple("auth", "Telegramni ulab oldi", undefined, () => null),
  "user.password_change": simple("auth", "parolini almashtirdi", undefined, () => null),
};

function discountText(i: SentenceInput): string | null {
  const v = num(i.m.value);
  if (v === null) return null;
  return i.m.kind === "percent" ? `${v}%` : som(v);
}

function salaryDetail(i: SentenceInput): string | null {
  const after = obj(i.m.after);
  const kind = str(i.m.kind) ?? str(after?.kind);
  const month = str(i.m.month) ?? str(after?.month);
  return parts(kind && (SALARY_KIND[kind] ?? kind), month);
}

function importDef(table: string): Def {
  return {
    section: "import",
    text: (i) => {
      const done = num(i.m.imported) ?? 0;
      const skipped = num(i.m.skipped) ?? 0;
      const what = IMPORT_TABLE[table] ?? table;
      return line(
        "Excel'dan import qildi",
        parts(`${done} ta ${what}`, skipped > 0 && `${skipped} tasi o'tkazib yuborildi`),
      );
    },
  };
}

const SETTING_LABEL: Record<string, string> = {
  student_fields: "o'quvchi formasi maydonlari",
  staff_fields: "xodim formasi maydonlari",
  lead_fields: "lid formasi maydonlari",
  leave_reasons: "guruhdan chiqish sabablari",
  lost_reasons: "lid yo'qotish sabablari",
};

/* ---------- Ochiq interfeys ---------- */

export const KNOWN_ACTIONS: readonly string[] = Object.keys(REGISTRY);

export const isKnownAction = (action: string) => action in REGISTRY;

/** Ro'yxatda alohida chiqmaydigan (boshqa yozuvning aksi) kalitlar */
export const MIRROR_ACTIONS: readonly string[] = Object.entries(REGISTRY)
  .filter(([, d]) => d.mirror)
  .map(([k]) => k);

/** Reyestrda yo'q kalitning bo'limi: kalit boshi (`lead.xxx` → lidlar) bo'yicha, bo'lmasa "other" */
const PREFIX_SECTION: Record<string, ActivitySection> = {
  student: "student",
  group: "group",
  teacher: "teacher",
  staff: "staff",
  position: "staff",
  lead: "lead",
  payment: "payment",
  discount: "payment",
  expense: "finance",
  additional_income: "finance",
  salary_entry: "finance",
  attendance: "attendance",
  approval: "approval",
  auth: "auth",
  user: "auth",
  import: "import",
};

export function sectionOf(action: string): ActivitySection {
  return REGISTRY[action]?.section ?? PREFIX_SECTION[action.split(".")[0] ?? ""] ?? "other";
}

/** Bo'lim bo'yicha SQL filtri uchun: shu bo'limning aniq kalitlari; "other" uchun — hamma bilinganlar (inkor) */
export function sectionActionIds(section: ActivitySection): { ids: string[]; negate: boolean } {
  if (section === "other") return { ids: [...KNOWN_ACTIONS], negate: true };
  return { ids: KNOWN_ACTIONS.filter((k) => REGISTRY[k]!.section === section), negate: false };
}

/** Jumla: "<kim> <nima qildi>: <tafsilot> — <nishon>" */
export function describeAction(
  action: string,
  actor: string | null,
  input: { metadata?: Meta | null; targetName?: string | null; targetId?: string | null },
): string {
  const who = actor?.trim() || "Tizim";
  const i: SentenceInput = { m: input.metadata ?? {}, who: input.targetName ?? null, targetId: input.targetId ?? null };
  const def = REGISTRY[action];
  return `${who} ${def ? def.text(i) : `«${action}» amalini bajardi`}`;
}

/* ---------- Tafsilot (sirsiz) ---------- */

const SECRET_KEY = /pass|parol|token|secret|otp|\bcode\b|\bkod\b|hash|api_?key/i;

export interface DetailItem {
  key: string;
  value: string;
}

const KEY_LABEL: Record<string, string> = {
  name: "Nomi",
  amount: "Summa",
  reason: "Sabab",
  voidReason: "Bekor qilish sababi",
  date: "Sana",
  month: "Oy",
  from: "Oldin",
  to: "Keyin",
  before: "Oldingi",
  after: "Yangi",
  group: "Guruh",
  student: "O'quvchi",
  kind: "Turi",
  title: "Sarlavha",
  note: "Izoh",
  phone: "Telefon",
  receiptNo: "Kvitansiya",
  marked: "Belgilandi",
  imported: "Import qilindi",
  skipped: "O'tkazildi",
  error: "Xato",
  attempts: "Urinishlar",
  newDevice: "Yangi qurilma",
};

const scalar = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "ha" : "yo'q";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  return "";
};

function redact(v: unknown, depth = 0): unknown {
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  if (v && typeof v === "object") {
    if (depth > 3) return "…";
    return Object.fromEntries(
      Object.entries(v as Meta).map(([k, x]) => [k, SECRET_KEY.test(k) ? "•••" : redact(x, depth + 1)]),
    );
  }
  return v;
}

/** Metadata → ko'rsatiladigan juftliklar; sir nomli kalitlar yashiriladi, ichma-ich qiymat JSON ko'rinishida */
export function safeMetadata(metadata: Meta | null | undefined): DetailItem[] {
  if (!metadata) return [];
  return Object.entries(metadata).map(([k, v]) => {
    const key = KEY_LABEL[k] ?? k;
    if (SECRET_KEY.test(k)) return { key, value: "•••" };
    if (v && typeof v === "object") return { key, value: JSON.stringify(redact(v)) };
    return { key, value: scalar(v) };
  });
}

/** Qurilma satridan qisqa nom: "Chrome · Windows" */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 60);
}

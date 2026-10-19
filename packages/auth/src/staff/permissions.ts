/*
 * Lavozim ruxsatlari katalogi — eski tizim (cosmoslc PositionsPage) bilan bir xil: 11 toifa, 69 ruxsat,
 * 7 tayyor shablon. Lavozim shu ro'yxatdagi id'larni saqlaydi; server amallari aniq ruxsatni tekshiradi.
 * Client komponentda ham ishlatiladi (Lavozimlar sahifasi) — server importi yo'q.
 *
 * "Tasdiq bilan" holati (direktor tasdig'i) — E3 da tasdiqlash so'rovlari bilan qo'shiladi.
 */

export const PERMISSION_CATEGORIES = [
  {
    id: "dashboard",
    title: "1. Boshqaruv Paneli va Statistika",
    permissions: [
      { id: "dashboard.view", name: "Boshqaruv panelini ko'rish" },
      { id: "dashboard.financial_stats", name: "Moliyaviy ko'rsatkichlar va daromad" },
      { id: "dashboard.conversion_stats", name: "Konversiya va Lidlar statistikasi" },
      { id: "dashboard.export", name: "Hisobotlarni eksport qilish" },
    ],
  },
  {
    id: "leads",
    title: "2. Lidlar va CRM (Sotuv Voronkasi)",
    permissions: [
      { id: "leads.view", name: "Lidlar ro'yxatini ko'rish" },
      { id: "leads.create", name: "Yangi lid qo'shish" },
      { id: "leads.edit", name: "Lid ma'lumotlarini tahrirlash" },
      { id: "leads.delete", name: "Lidni o'chirish / arxivga o'tkazish" },
      { id: "leads.call_log", name: "Qo'ng'iroq va suhbat tarixini yozish" },
      { id: "leads.status_change", name: "Bosqichdan bosqichga o'tkazish (Kanban)" },
      { id: "leads.convert_to_student", name: "Lidni talabaga aylantirish" },
      { id: "leads.reassign", name: "Lidni boshqa xodimga biriktirish" },
      { id: "leads.import_export", name: "Excel orqali import va eksport" },
    ],
  },
  {
    id: "students",
    title: "3. Talabalar Boshqaruvi",
    permissions: [
      { id: "students.view", name: "Talabalar ro'yxatini ko'rish" },
      { id: "students.create", name: "Yangi talaba ro'yxatdan o'tkazish" },
      { id: "students.edit", name: "Talaba ma'lumotlarini tahrirlash" },
      { id: "students.delete", name: "Talabani o'chirish / arxivlash" },
      { id: "students.balance_edit", name: "Talaba balansiga tuzatish kiritish" },
      { id: "students.sms_send", name: "Shaxsiy SMS xabar yuborish" },
      { id: "students.contract_print", name: "Shartnoma va guvohnoma chop etish" },
      { id: "students.freeze", name: "O'qishni vaqtincha muzlatish" },
    ],
  },
  {
    id: "groups",
    title: "4. Guruhlar va Dars Jadvali",
    permissions: [
      { id: "groups.view", name: "Guruhlar ro'yxatini ko'rish" },
      { id: "groups.create", name: "Yangi guruh ochish" },
      { id: "groups.edit", name: "Guruh parametrlarini tahrirlash" },
      { id: "groups.delete", name: "Guruhni yakunlash / o'chirish" },
      { id: "groups.add_student", name: "Guruhga talaba biriktirish" },
      { id: "groups.remove_student", name: "Guruhdan talabani chiqarish" },
      { id: "groups.change_teacher", name: "O'qituvchini almashtirish" },
      { id: "groups.attendance_view", name: "Guruh davomat tarixini ko'rish" },
    ],
  },
  {
    id: "attendance",
    title: "5. Davomat va Keldi-Ketdi",
    permissions: [
      { id: "attendance.student_mark", name: "Talabalar davomatini olish" },
      { id: "attendance.student_edit_past", name: "O'tgan kunlar davomatini o'zgartirish" },
      { id: "attendance.employee_view", name: "Xodimlar davomatini ko'rish" },
      { id: "attendance.employee_mark", name: "Xodimlar davomatini belgilash" },
      { id: "attendance.export", name: "Davomat jurnalini yuklab olish" },
    ],
  },
  {
    id: "finance_payments",
    title: "6. Moliya: To'lovlar va Kassa",
    permissions: [
      { id: "finance.payment_view", name: "To'lovlar ro'yxatini ko'rish" },
      { id: "finance.payment_create", name: "To'lov qabul qilish" },
      { id: "finance.payment_edit", name: "To'lovni tahrirlash" },
      { id: "finance.payment_delete", name: "To'lovni bekor qilish / o'chirish" },
      { id: "finance.payment_receipt_print", name: "To'lov chekini chop etish" },
      { id: "finance.debtors_view", name: "Qarzdorlar ro'yxatini ko'rish" },
      { id: "finance.debtors_remind", name: "Qarzdorlarga eslatma yuborish" },
      { id: "finance.advance_give", name: "Avans berish va hisobdan chiqarish" },
    ],
  },
  {
    id: "finance_salaries",
    title: "7. Moliya: Ish Haqi va Avanslar",
    permissions: [
      { id: "salaries.view", name: "Maoshlar jadvalini ko'rish" },
      { id: "salaries.calculate", name: "Ish haqini hisoblash" },
      { id: "salaries.pay", name: "Ish haqini to'lash" },
      { id: "salaries.advance_manage", name: "Avanslarni tasdiqlash" },
      { id: "salaries.kpi_edit", name: "KPI, bonus va jarimalar kiritish" },
    ],
  },
  {
    id: "finance_expenses",
    title: "8. Moliya: Xarajatlar va Qo'shimcha Daromad",
    permissions: [
      { id: "expenses.view", name: "Xarajatlar ro'yxatini ko'rish" },
      { id: "expenses.create", name: "Yangi xarajat kiritish" },
      { id: "expenses.edit_delete", name: "Xarajatni tahrirlash yoki o'chirish" },
      { id: "expenses.categories", name: "Xarajat toifalarini boshqarish" },
      { id: "additional_income.view", name: "Qo'shimcha daromadlarni ko'rish" },
      { id: "additional_income.create", name: "Qo'shimcha daromad kiritish" },
      { id: "bonuses.manage", name: "Bonus tizimini boshqarish" },
    ],
  },
  {
    id: "staff",
    title: "9. Xodimlar va O'qituvchilar (HR)",
    permissions: [
      { id: "staff.view", name: "Xodimlar ro'yxatini ko'rish" },
      { id: "staff.create", name: "Yangi xodim / ustoz qo'shish" },
      { id: "staff.edit", name: "Xodim ma'lumotlarini tahrirlash" },
      { id: "staff.delete", name: "Xodimni bo'shatish / arxivlash" },
      { id: "staff.roles_assign", name: "Lavozim va ruxsatlarni biriktirish" },
    ],
  },
  {
    id: "settings",
    title: "10. Tizim Sozlamalari",
    permissions: [
      { id: "settings.branches", name: "Filiallarni boshqarish" },
      { id: "settings.rooms", name: "Xonalar va sig'imlarni sozlash" },
      { id: "settings.courses", name: "Kurslar va narxlar katalogi" },
      { id: "settings.roles_permissions", name: "Lavozimlar va ruxsatlarni sozlash" },
      { id: "settings.sms_gateways", name: "SMS provayder va avto-SMS shablonlari" },
      { id: "settings.receipt", name: "Chek va printer sozlamalari" },
      { id: "settings.coins", name: "Coin qoidalari va miqdorlari" },
      { id: "settings.logs", name: "Tizim harakatlari jurnali (Audit Logs)" },
    ],
  },
  {
    id: "archive",
    title: "11. Tizim Arxivi (Recycle Bin)",
    permissions: [
      { id: "archive.view", name: "Arxivdagi yozuvlarni ko'rish" },
      { id: "archive.restore", name: "Arxivdan ma'lumotlarni qayta tiklash" },
      { id: "archive.permanent_delete", name: "Butunlay o'chirib yuborish" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_CATEGORIES)[number]["permissions"][number]["id"];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.id),
);

const ALL_SET = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (v: string): v is Permission => ALL_SET.has(v);

/** Katalogdagi tartibda, takrorsiz va noma'lumlarsiz */
export function normalizePermissions(ids: Iterable<string>): Permission[] {
  const set = new Set(ids);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

/*
 * "Tasdiq bilan" bo'la oladigan ruxsatlar (EDU-CRM-PLAN E3d, ADR 0019). Eski tizimdagidek ko'rish, eksport, chop
 * etish, boshqaruv paneli va ruxsatlarni boshqarishning o'zi tasdiq bilan bo'lmaydi — ular yo ruxsat, yo taqiq.
 */
const NOT_APPROVABLE = new Set<string>(["settings.roles_permissions", "settings.logs", "staff.roles_assign"]);
export function isApprovable(p: string): boolean {
  if (!isPermission(p) || NOT_APPROVABLE.has(p)) return false;
  if (p.startsWith("dashboard.")) return false;
  return !/(^|[._])(view|export|print)$/.test(p);
}

/* ---------- Tayyor shablonlar (eski tizimdagi 7 ta lavozim) ---------- */

export interface PositionTemplate {
  code: string;
  name: string;
  color: string;
  /** Tizim lavozimi: o'chirilmaydi va ruxsatlari o'zgartirilmaydi */
  system: boolean;
  permissions: readonly Permission[];
}

const all = ALL_PERMISSIONS;
export const POSITION_TEMPLATES: readonly PositionTemplate[] = [
  { code: "super_admin", name: "Bosh Direktor (Super Admin)", color: "#6366f1", system: true, permissions: all },
  {
    code: "branch_manager",
    name: "Filial Menejeri",
    color: "#0ea5e9",
    system: false,
    permissions: all.filter(
      (p) => !["settings.roles_permissions", "settings.logs", "archive.permanent_delete"].includes(p),
    ),
  },
  {
    code: "senior_admin",
    name: "Katta Administrator",
    color: "#8b5cf6",
    system: false,
    permissions: [
      "dashboard.view",
      "leads.view",
      "leads.create",
      "leads.edit",
      "leads.call_log",
      "leads.status_change",
      "leads.convert_to_student",
      "students.view",
      "students.create",
      "students.edit",
      "students.sms_send",
      "students.contract_print",
      "groups.view",
      "groups.add_student",
      "groups.attendance_view",
      "attendance.student_mark",
      "finance.payment_view",
      "finance.payment_create",
      "finance.payment_receipt_print",
      "finance.debtors_view",
      "finance.debtors_remind",
      "additional_income.view",
      "additional_income.create",
      "staff.view",
      "archive.view",
    ],
  },
  {
    code: "teacher",
    name: "O'qituvchi / Mentor",
    color: "#10b981",
    system: false,
    permissions: [
      "dashboard.view",
      "students.view",
      "groups.view",
      "groups.attendance_view",
      "attendance.student_mark",
      "bonuses.manage",
    ],
  },
  {
    code: "accountant",
    name: "Buxgalter / Kassir",
    color: "#14b8a6",
    system: false,
    permissions: [
      "dashboard.view",
      "dashboard.financial_stats",
      "dashboard.export",
      "students.view",
      "students.balance_edit",
      "finance.payment_view",
      "finance.payment_create",
      "finance.payment_edit",
      "finance.payment_receipt_print",
      "finance.debtors_view",
      "finance.advance_give",
      "salaries.view",
      "salaries.calculate",
      "salaries.pay",
      "salaries.advance_manage",
      "salaries.kpi_edit",
      "expenses.view",
      "expenses.create",
      "expenses.edit_delete",
      "expenses.categories",
      "additional_income.view",
      "additional_income.create",
      "archive.view",
    ],
  },
  {
    code: "sales_lead_manager",
    name: "Sotuv va Lid Menejeri",
    color: "#f59e0b",
    system: false,
    permissions: [
      "dashboard.view",
      "dashboard.conversion_stats",
      "leads.view",
      "leads.create",
      "leads.edit",
      "leads.call_log",
      "leads.status_change",
      "leads.convert_to_student",
      "leads.reassign",
      "leads.import_export",
      "students.view",
      "students.create",
      "students.sms_send",
      "groups.view",
    ],
  },
  {
    code: "hr_manager",
    name: "HR Menejer",
    color: "#ec4899",
    system: false,
    permissions: [
      "dashboard.view",
      "attendance.employee_view",
      "attendance.employee_mark",
      "staff.view",
      "staff.create",
      "staff.edit",
      "staff.roles_assign",
      "salaries.view",
    ],
  },
];

import type { Permission } from "@ventura/auth/staff/policy";

/*
 * Sahifa (menyu manzili) → uni ochadigan ruxsatlar (birortasi yetadi). Eski tizimdagi PAGE_PERMISSION_MAP bilan bir xil
 * mantiq: masalan Kurslar sahifasi "Kurslar va narxlar katalogi" ruxsati bilan ochiladi. Bo'limning o'zi yoqilganmi —
 * alohida (hasFeature). Ro'yxatda yo'q manzil faqat direktorga ochiq.
 */
export const PAGE_ACCESS: Record<string, readonly Permission[]> = {
  "/students": [
    "students.view",
    "students.create",
    "students.edit",
    "students.delete",
    "students.balance_edit",
    "students.sms_send",
    "students.contract_print",
    "students.freeze",
  ],
  "/groups": [
    "groups.view",
    "groups.create",
    "groups.edit",
    "groups.delete",
    "groups.add_student",
    "groups.remove_student",
    "groups.change_teacher",
    "groups.attendance_view",
  ],
  "/teachers": ["staff.view", "staff.create", "staff.edit"],
  "/staff": ["staff.view", "staff.create", "staff.edit", "staff.delete", "staff.roles_assign"],
  "/positions": ["settings.roles_permissions"],
  "/archive": ["archive.view", "archive.restore", "archive.permanent_delete"],
  "/courses": ["settings.courses"],
  "/rooms": ["settings.rooms"],
  "/branches": ["settings.branches"],
  "/holidays": ["settings.branches"],
  "/attendance": ["attendance.student_mark", "attendance.student_edit_past", "attendance.export"],
  "/staff-attendance": ["attendance.employee_view", "attendance.employee_mark"],
  "/payments": [
    "finance.payment_view",
    "finance.payment_create",
    "finance.payment_edit",
    "finance.payment_delete",
    "finance.payment_receipt_print",
  ],
  "/debtors": ["finance.debtors_view", "finance.debtors_remind"],
  "/expenses": ["expenses.view", "expenses.create", "expenses.edit_delete", "expenses.categories"],
  "/salaries": ["salaries.view", "salaries.calculate", "salaries.pay", "salaries.advance_manage", "salaries.kpi_edit"],
  "/leads": [
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.delete",
    "leads.call_log",
    "leads.status_change",
    "leads.convert_to_student",
    "leads.reassign",
    "leads.import_export",
  ],
  "/exams": ["settings.courses"],
  "/coins": ["bonuses.manage"],
  "/sms": ["settings.sms_gateways"],
  "/reports": ["dashboard.view", "dashboard.financial_stats", "dashboard.conversion_stats"],
};

export const pagePermissions = (href: string): readonly Permission[] => PAGE_ACCESS[href] ?? [];

import "server-only";
import { restoreIncomeAction, saveIncomeAction, voidIncomeAction } from "@/app/(crm)/additional-income/actions";
import {
  deleteCategoryAction,
  deletePlanAction,
  restoreExpenseAction,
  saveCategoryAction,
  saveExpenseAction,
  savePlanAction,
  voidExpenseAction,
} from "@/app/(crm)/expenses/actions";
import {
  activateMembershipAction,
  archiveGroupAction,
  enrollStudentAction,
  enrollStudentsAction,
  leaveMembershipAction,
  leaveStudentsAction,
  pauseMembershipAction,
  saveGroupAction,
} from "@/app/(crm)/groups/actions";
import { markAttendanceAction, markRestPresentAction } from "@/app/(crm)/groups/attendance-actions";
import {
  archiveLeadAction,
  assignLeadsAction,
  activateWaitlistAction,
  assignWaitlistAction,
  convertLeadAction,
  loseLeadAction,
  moveLeadAction,
  restoreLeadAction,
  saveLeadAction,
  scheduleFirstLessonAction,
} from "@/app/(crm)/leads/actions";
import {
  correctionAction,
  deleteDiscountAction,
  editEntryAction,
  recordPaymentAction,
  refundAction,
  restoreEntryAction,
  saveDiscountAction,
  voidEntryAction,
} from "@/app/(crm)/payments/actions";
import { restoreSalaryEntryAction, saveSalaryEntryAction, voidSalaryEntryAction } from "@/app/(crm)/salaries/actions";
import { markEmployeeAction, markEmployeesPresentAction } from "@/app/(crm)/staff-attendance/actions";
import {
  archiveStudentAction,
  saveStudentAction,
  setStudentStatusAction,
  transferStudentAction,
} from "@/app/(crm)/students/actions";

/*
 * "Tasdiq bilan" bo'la oladigan amallar reyestri (ADR 0019): kalit → server amali. Direktor so'rovni tasdiqlaganda
 * shu amal saqlangan kirish bilan, direktor sessiyasida chaqiriladi — ruxsat, filial, Zod va qulf tekshiruvlari
 * oddiy chaqiruvdagidek ishlaydi. Yangi amal "tasdiq bilan" bo'lishi uchun shu yerga qo'shiladi va crmAction'ga
 * `{ approval: { action, input } }` beriladi (lib/uz.ts `approvals.actions` da nomi).
 */
export const APPROVAL_ACTIONS = {
  "payments.record": recordPaymentAction,
  "payments.refund": refundAction,
  "payments.correction": correctionAction,
  "payments.void": voidEntryAction,
  "payments.restore": restoreEntryAction,
  "payments.edit": editEntryAction,
  "payments.discount": saveDiscountAction,
  "payments.discountDelete": deleteDiscountAction,
  "expenses.save": saveExpenseAction,
  "expenses.void": voidExpenseAction,
  "expenses.restore": restoreExpenseAction,
  "expenses.category": saveCategoryAction,
  "expenses.categoryDelete": deleteCategoryAction,
  "expenses.plan": savePlanAction,
  "expenses.planDelete": deletePlanAction,
  "incomes.save": saveIncomeAction,
  "incomes.void": voidIncomeAction,
  "incomes.restore": restoreIncomeAction,
  "salaries.save": saveSalaryEntryAction,
  "salaries.void": voidSalaryEntryAction,
  "salaries.restore": restoreSalaryEntryAction,
  "students.save": saveStudentAction,
  "students.status": setStudentStatusAction,
  "students.archive": archiveStudentAction,
  "students.transfer": transferStudentAction,
  "groups.save": saveGroupAction,
  "groups.archive": archiveGroupAction,
  "groups.enroll": enrollStudentAction,
  "groups.activate": activateMembershipAction,
  "groups.pause": pauseMembershipAction,
  "groups.leave": leaveMembershipAction,
  "groups.enrollMany": enrollStudentsAction,
  "groups.leaveMany": leaveStudentsAction,
  "leads.save": saveLeadAction,
  "leads.move": moveLeadAction,
  "leads.assign": assignLeadsAction,
  "leads.archive": archiveLeadAction,
  "leads.convert": convertLeadAction,
  "leads.firstLesson": scheduleFirstLessonAction,
  "leads.lose": loseLeadAction,
  "leads.restore": restoreLeadAction,
  "leads.waitlist": assignWaitlistAction,
  "leads.waitlistActivate": activateWaitlistAction,
  "attendance.mark": markAttendanceAction,
  "attendance.markRest": markRestPresentAction,
  "staffAttendance.mark": markEmployeeAction,
  "staffAttendance.markRest": markEmployeesPresentAction,
} as const;

export type ApprovalKey = keyof typeof APPROVAL_ACTIONS;

export const isApprovalKey = (k: string): k is ApprovalKey => Object.hasOwn(APPROVAL_ACTIONS, k);

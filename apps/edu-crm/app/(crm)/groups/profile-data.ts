import "server-only";
import type * as React from "react";
import { type StaffAccess, can } from "@ventura/auth/staff/policy";
import { type Tenant, hasFeature } from "@ventura/tenants";
import { groupAttendance } from "@/lib/server/attendance";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { getGradingSettings, groupGradeMarks } from "@/lib/server/grades";
import { monthRange } from "@/lib/lessons";
import { todayTashkent } from "@/lib/server/memberships";
import type { PickerBranch } from "../branch-picker";
import { financePerms } from "../payments/perms";
import { getStudentFields, groupChoices } from "../students/data";
import { groupFormOptions, groupMembers, groupProfileStats, listGroups, studentCandidates } from "./data";
import type { GroupProfile } from "./group-profile";
import { groupPerms } from "./perms";

export type GroupProfileProps = React.ComponentProps<typeof GroupProfile>;

/**
 * Guruh profili sahifasi uchun hamma ma'lumot (sahifa va dev ko'rinishi uchun bitta joy). `scope` — xodimning
 * filial cheklovi (null — hammasi); guruh topilmasa yoki ko'rinmasa null.
 */
export async function loadGroupProfile(args: {
  tenant: Tenant;
  access: StaffAccess;
  scope: string[] | null;
  branches: PickerBranch[];
  id: string;
  tab?: string;
  month?: string;
}): Promise<GroupProfileProps | null> {
  const { tenant, access, scope, branches, id } = args;
  const db = getTenantDb(tenant);
  const [group] = await listGroups(db, scope, id);
  if (!group) return null;

  const today = todayTashkent();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(args.month ?? "") ? args.month! : today.slice(0, 7);
  const [attendanceOn, paymentsOn, gradesOn] = await Promise.all([
    hasFeature(tenant, "attendance"),
    hasFeature(tenant, "payments"),
    hasFeature(tenant, "grades"),
  ]);
  const fin = financePerms(access);
  const financeOn = fin.view && paymentsOn;
  const canPay = fin.create && paymentsOn;
  const studentFields = await getStudentFields(db);

  const members = await groupMembers(db, group.id);
  const [stats, candidates, options, studentGroups, attendance, methods, settings] = await Promise.all([
    groupProfileStats(db, group.id, today, members.open, { finance: financeOn, attendance: attendanceOn }),
    studentCandidates(db, scope),
    groupFormOptions(db, scope),
    groupChoices(db, scope, studentFields),
    attendanceOn || gradesOn ? groupAttendance(db, group, month) : Promise.resolve(null),
    canPay ? ensurePaymentMethods(db) : Promise.resolve(null),
    canPay ? getFinanceSettings(db) : Promise.resolve(null),
  ]);

  // Baholar (ADR 0061): dars kunlari, a'zolar va davomat belgilari davomat bilan umumiy
  const [from, to] = monthRange(month);
  const grades =
    gradesOn && attendance
      ? {
          lessons: attendance,
          marks: await groupGradeMarks(
            db,
            group.id,
            from,
            to,
            attendance.members.map((m) => m.studentId),
          ),
          scale: (await getGradingSettings(db)).scale,
        }
      : null;
  const initialTab =
    args.tab === "attendance" && attendanceOn
      ? "attendance"
      : args.tab === "grades" && grades
        ? "grades"
        : args.tab === "left"
          ? "left"
          : "students";

  return {
    group,
    members,
    stats,
    candidates,
    courses: options.courses,
    teachers: options.teachers,
    rooms: options.rooms,
    studentFields,
    studentGroups: studentGroups.filter((x) => !x.archived),
    branches,
    perms: groupPerms(access),
    canCreateStudent: can(access, "students.create"),
    attendance: attendanceOn ? attendance : null,
    grades,
    canGradeToday: can(access, "grades.mark"),
    canGradePast: can(access, "grades.edit_past"),
    today,
    canMarkToday: can(access, "attendance.student_mark"),
    canEditPast: can(access, "attendance.student_edit_past"),
    initialTab,
    payment: methods && settings ? { methods, maxDiscountPercent: settings.maxDiscountPercent } : null,
  };
}

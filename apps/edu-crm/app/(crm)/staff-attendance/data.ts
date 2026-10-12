import "server-only";
import { and, gte, lte } from "drizzle-orm";
import type { StaffAccess } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { type EmployeeAttendanceStatus, employeeAttendance } from "@ventura/db/schema/tenant";
import { uz } from "@/lib/uz";
import { listStaff } from "../staff/data";
import { listTeachers } from "../teachers/data";

/*
 * Xodimlar davomati (ADR 0014): xodimlar (direktorsiz) va o'qituvchilar bitta ro'yxatda. Kalit — "u:<id>" yoki
 * "t:<id>", chunki ular alohida jadvallarda.
 */

export interface Employee {
  key: string;
  kind: "user" | "teacher";
  id: string;
  name: string;
  /** Lavozimlari yoki "O'qituvchi" / "Support o'qituvchi" */
  role: string;
  phone: string;
}

export interface EmployeeMark {
  status: EmployeeAttendanceStatus;
  checkIn: string | null;
  note: string | null;
}

export interface EmployeeRecord extends EmployeeMark {
  key: string;
  date: string;
}

export const userKey = (id: string) => `u:${id}`;
export const teacherKey = (id: string) => `t:${id}`;

export async function listEmployees(
  db: TenantDb,
  viewer: { id: string; access: StaffAccess },
  filter: readonly string[] | null,
): Promise<Employee[]> {
  const [staff, teachers] = await Promise.all([listStaff(db, viewer, filter), listTeachers(db, filter)]);
  return [
    ...staff.map((s) => ({
      key: userKey(s.id),
      kind: "user" as const,
      id: s.id,
      name: s.name,
      role: s.positions.map((p) => p.name).join(", ") || uz.staffAttendance.roleStaff,
      phone: s.phone,
    })),
    ...teachers.map((t) => ({
      key: teacherKey(t.id),
      kind: "teacher" as const,
      id: t.id,
      name: t.name,
      role: t.kind === "support" ? uz.staffAttendance.roleSupport : uz.staffAttendance.roleTeacher,
      phone: t.phone,
    })),
  ];
}

export async function employeeRecords(db: TenantDb, from: string, to: string): Promise<EmployeeRecord[]> {
  const rows = await db
    .select()
    .from(employeeAttendance)
    .where(and(gte(employeeAttendance.date, from), lte(employeeAttendance.date, to)));
  return rows.map((r) => ({
    key: r.userId ? userKey(r.userId) : teacherKey(r.teacherId!),
    date: r.date,
    status: r.status,
    checkIn: r.checkIn,
    note: r.note,
  }));
}

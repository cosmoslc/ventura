import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import { type SalaryEntryKind, paymentMethods, salaryEntries, teachers, users } from "@ventura/db/schema/tenant";
import { personValue } from "@/lib/server/expenses";

export interface SalaryEntryRow {
  id: string;
  /** "user:<id>" / "teacher:<id>" */
  person: string;
  personName: string;
  personPhone: string;
  role: "teacher" | "support" | "staff";
  kind: SalaryEntryKind;
  amount: number;
  month: string;
  date: string;
  methodId: string | null;
  methodName: string | null;
  note: string | null;
  createdByName: string | null;
  voided: { at: string; by: string | null; reason: string | null } | null;
}

const person = alias(users, "person");
const creator = alias(users, "creator");
const voider = alias(users, "voider");
const localPhone = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-9);

/** Sana oralig'idagi yozuvlar (bekor qilinganlari ham); filial cheklovi sahifada — ko'rinadigan xodimlar bo'yicha */
export async function listSalaryEntries(db: TenantDb, range: { from: string; to: string }): Promise<SalaryEntryRow[]> {
  const rows = await db
    .select({
      e: salaryEntries,
      userName: person.name,
      userPhone: person.phoneNumber,
      teacherName: teachers.name,
      teacherPhone: teachers.phone,
      teacherKind: teachers.kind,
      methodName: paymentMethods.name,
      createdByName: creator.name,
      voidedByName: voider.name,
    })
    .from(salaryEntries)
    .leftJoin(person, eq(person.id, salaryEntries.userId))
    .leftJoin(teachers, eq(teachers.id, salaryEntries.teacherId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, salaryEntries.methodId))
    .leftJoin(creator, eq(creator.id, salaryEntries.createdBy))
    .leftJoin(voider, eq(voider.id, salaryEntries.voidedBy))
    .where(and(gte(salaryEntries.date, range.from), lte(salaryEntries.date, range.to)))
    .orderBy(desc(salaryEntries.date), desc(salaryEntries.createdAt));
  return rows.map((r) => ({
    id: r.e.id,
    person: personValue(r.e)!,
    personName: r.userName ?? r.teacherName ?? "—",
    personPhone: localPhone(r.userPhone ?? r.teacherPhone),
    role: r.e.teacherId ? (r.teacherKind === "support" ? "support" : "teacher") : "staff",
    kind: r.e.kind,
    amount: r.e.amount,
    month: r.e.month,
    date: r.e.date,
    methodId: r.e.methodId,
    methodName: r.methodName,
    note: r.e.note,
    createdByName: r.createdByName,
    voided: r.e.voidedAt ? { at: r.e.voidedAt.toISOString(), by: r.voidedByName, reason: r.e.voidReason } : null,
  }));
}

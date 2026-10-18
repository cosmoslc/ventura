import "server-only";
import { desc, eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { type SmsMessageStatus, smsMessages, students } from "@ventura/db/schema/tenant";

/* So'nggi SMS xabarlari (S3): navbat va natija — SMS bosh sahifasida. To'liq hisobot va filtrlar — keyingi bosqichda. */

export interface SmsMessageRow {
  id: string;
  createdAt: string;
  studentId: string | null;
  studentName: string | null;
  recipient: "student" | "parent" | "staff" | "other";
  phone: string;
  text: string;
  parts: number;
  cost: number | null;
  status: SmsMessageStatus;
  error: string | null;
}

export async function recentMessages(db: TenantDb, limit = 50): Promise<SmsMessageRow[]> {
  const rows = await db
    .select({
      id: smsMessages.id,
      createdAt: smsMessages.createdAt,
      studentId: smsMessages.studentId,
      studentName: students.name,
      recipient: smsMessages.recipient,
      phone: smsMessages.phone,
      text: smsMessages.text,
      parts: smsMessages.parts,
      cost: smsMessages.cost,
      status: smsMessages.status,
      error: smsMessages.error,
    })
    .from(smsMessages)
    .leftJoin(students, eq(students.id, smsMessages.studentId))
    .orderBy(desc(smsMessages.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import {
  type ApprovalStatus,
  approvalRequests,
  financeCategories,
  groups,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { formatDate, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { ApprovalKey } from "./approval-registry";
import { type BranchContext, resolveBranch } from "./branch";
import type { Staff } from "./session";

/*
 * Tasdiq so'rovlari (ADR 0019): yaratish (crmAction "tasdiq bilan" bo'lganda) va ro'yxat. So'rov sarlavhasi va qisqa
 * mazmuni yaratilganda kirishdan yig'iladi (o'quvchi, guruh, xodim nomi, summa, oy, sana, sabab) — direktor nima
 * tasdiqlayotganini ko'radi. Kirish bajarilganda amalning o'z Zod sxemasi bilan qayta tekshiriladi.
 */

const MAX_PAYLOAD = 20_000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Kirishda filial bo'sh bo'lsa — so'rovchining tanlovidan (direktor boshqa filialni tanlagan bo'lishi mumkin) */
function withBranch(input: unknown, branch: BranchContext): unknown {
  if (!isObj(input) || !("branchId" in input) || input.branchId) return input;
  return { ...input, branchId: resolveBranch(branch, null) };
}

async function nameOf(db: TenantDb, input: Obj): Promise<string | null> {
  const studentId = str(input.studentId);
  if (studentId) {
    const [s] = await db.select({ name: students.name }).from(students).where(eq(students.id, studentId));
    if (s) return s.name;
  }
  const person = str(input.person);
  if (person) {
    const [kind, id] = person.split(":");
    if (kind === "user" && id) {
      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
      if (u) return u.name;
    }
    if (kind === "teacher" && id) {
      const [t] = await db.select({ name: teachers.name }).from(teachers).where(eq(teachers.id, id));
      if (t) return t.name;
    }
  }
  const name = str(input.name) ?? str(input.title) ?? str(input.reason);
  if (name && !str(input.studentId)) return name.slice(0, 80);
  return null;
}

async function summaryOf(db: TenantDb, input: Obj): Promise<string | null> {
  const parts: string[] = [];
  const groupId = str(input.groupId);
  if (groupId) {
    const [g] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId));
    if (g) parts.push(g.name);
  }
  const categoryId = str(input.categoryId);
  if (categoryId) {
    const [c] = await db
      .select({ name: financeCategories.name })
      .from(financeCategories)
      .where(eq(financeCategories.id, categoryId));
    if (c) parts.push(c.name);
  }
  if (typeof input.amount === "number") parts.push(`${money(input.amount)} ${uz.common.som}`);
  const month = str(input.month);
  if (month && /^\d{4}-\d{2}$/.test(month)) parts.push(formatMonth(month));
  const date = str(input.date);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) parts.push(formatDate(date));
  const status = str(input.status);
  if (status && uz.students.status[status]) parts.push(uz.students.status[status]!);
  for (const k of ["reason", "note"] as const) {
    const v = str(input[k]);
    if (v) parts.push(v.slice(0, 120));
  }
  return parts.length ? parts.join(" · ") : null;
}

export async function createApprovalRequest(
  db: TenantDb,
  opts: { staff: Staff; branch: BranchContext; permission: string; action: ApprovalKey; input: unknown },
): Promise<{ id: string; title: string }> {
  const input = withBranch(opts.input, opts.branch);
  const json = JSON.stringify(input ?? null);
  if (json.length > MAX_PAYLOAD) throw new Error("approval payload too large");
  const label = uz.approvals.actions[opts.action] ?? opts.action;
  const who = isObj(input) ? await nameOf(db, input) : null;
  const title = (who ? `${who}: ${label.toLowerCase()}` : label).slice(0, 300);
  const summary = isObj(input) ? await summaryOf(db, input) : null;
  const [row] = await db
    .insert(approvalRequests)
    .values({
      requestedBy: opts.staff.id,
      permission: opts.permission,
      action: opts.action,
      title,
      summary,
      payload: JSON.parse(json) as unknown,
    })
    .returning({ id: approvalRequests.id });
  return { id: row!.id, title };
}

export interface ApprovalRow {
  id: string;
  action: string;
  permission: string;
  title: string;
  summary: string | null;
  status: ApprovalStatus;
  requestedById: string;
  requestedByName: string;
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  lastError: string | null;
}

const requester = alias(users, "requester");
const decider = alias(users, "decider");

/** So'rovlar: direktor — hammasi, xodim — faqat o'ziniki (`mine`) */
export async function listApprovalRequests(
  db: TenantDb,
  opts: { mine?: string; statuses?: readonly ApprovalStatus[] } = {},
): Promise<ApprovalRow[]> {
  const rows = await db
    .select({ r: approvalRequests, requestedByName: requester.name, decidedByName: decider.name })
    .from(approvalRequests)
    .innerJoin(requester, eq(requester.id, approvalRequests.requestedBy))
    .leftJoin(decider, eq(decider.id, approvalRequests.decidedBy))
    .where(
      and(
        opts.mine ? eq(approvalRequests.requestedBy, opts.mine) : undefined,
        opts.statuses ? inArray(approvalRequests.status, [...opts.statuses]) : undefined,
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(500);
  return rows.map(({ r, requestedByName, decidedByName }) => ({
    id: r.id,
    action: r.action,
    permission: r.permission,
    title: r.title,
    summary: r.summary,
    status: r.status,
    requestedById: r.requestedBy,
    requestedByName,
    createdAt: r.createdAt.toISOString(),
    decidedByName,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionNote: r.decisionNote,
    lastError: r.lastError,
  }));
}

/** Menyudagi son: direktorga — kutilayotganlar, xodimga — o'zining kutilayotganlari */
export async function pendingApprovalCount(db: TenantDb, staff: Pick<Staff, "id" | "director">) {
  const rows = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.status, "pending"),
        staff.director ? undefined : eq(approvalRequests.requestedBy, staff.id),
      ),
    );
  return rows.length;
}

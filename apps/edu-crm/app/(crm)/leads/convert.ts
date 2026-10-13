import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { formatPhone } from "@ventura/auth/policy";
import type { TenantDb } from "@ventura/db";
import { groupMemberships, groups, leadEvents, leads, students } from "@ventura/db/schema/tenant";
import { cleanCustomData } from "@/lib/form-fields";
import type { ActionCtx } from "@/lib/server/action";
import { todayTashkent } from "@/lib/server/memberships";
import { uz } from "@/lib/uz";
import { getStudentFields } from "../students/data";
import { listStages } from "./data";

type Lead = typeof leads.$inferSelect;
type Tx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];

export interface Converted {
  leadId: string;
  name: string;
  studentId: string;
  existing: boolean;
  membershipId: string | null;
}

/**
 * Lidlarni o'quvchiga aylantirish (ADR 0023, 0024) — bitta lid ("O'quvchiga aylantirish") va zahira guruhni
 * faollashtirish uchun bitta mantiq. Avval hammasi tekshiriladi; biror lid mos kelmasa hech narsa yozilmaydi.
 * Har lid: shu telefonli o'quvchiga bog'lanadi yoki yangisi yaratiladi, guruh berilsa — sinovda qo'shiladi,
 * lid "O'quvchi bo'ldi" bosqichiga o'tadi (zahira guruhdan chiqadi). `extra` — shu tranzaksiya ichidagi qo'shimcha ish.
 */
export async function convertLeads(
  ctx: ActionCtx,
  list: readonly Lead[],
  groupId: string | null,
  extra?: (tx: Tx) => Promise<void>,
): Promise<
  { ok: true; converted: Converted[]; group: { id: string; name: string } | null } | { ok: false; error: string }
> {
  const stages = await listStages(ctx.db);
  const won = stages.find((s) => s.kind === "won")!;
  for (const l of list) {
    if (stages.find((s) => s.id === l.stageId)?.kind !== "open")
      return { ok: false, error: uz.leads.notOpenNamed(l.name) };
  }

  const [g] = groupId
    ? await ctx.db
        .select({ id: groups.id, name: groups.name, branchId: groups.branchId })
        .from(groups)
        .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
    : [];
  if (groupId && (!g || !ctx.branch.options.some((b) => b.id === g.branchId)))
    return { ok: false, error: uz.groups.groupArchived };

  const phones = [...new Set(list.map((l) => l.phone))];
  const existingRows = phones.length
    ? await ctx.db
        .select()
        .from(students)
        .where(and(inArray(students.phone, phones), isNull(students.archivedAt)))
    : [];
  const existingOf = (l: Lead) => existingRows.find((s) => s.phone === l.phone);
  for (const l of list) {
    const ex = existingOf(l);
    if (ex && !ctx.branch.options.some((b) => b.id === ex.branchId))
      return { ok: false, error: uz.leads.studentOtherBranch };
    if (g && (ex?.branchId ?? l.branchId) !== g.branchId) return { ok: false, error: uz.groups.branchMismatch };
  }

  const studentFields = await getStudentFields(ctx.db);
  const today = todayTashkent();
  const converted = await ctx.db.transaction(async (tx) => {
    const out: Converted[] = [];
    // Bir xil telefonli ikki lid bitta o'quvchiga tushadi
    const created = new Map<string, string>();
    for (const l of list) {
      const ex = existingOf(l);
      let studentId = ex?.id ?? created.get(l.phone);
      const isNew = !studentId;
      if (!studentId) {
        const [row] = await tx
          .insert(students)
          .values({
            branchId: l.branchId,
            name: l.name,
            phone: l.phone,
            parentPhone: l.phone2,
            gender: l.gender,
            source: l.source,
            interestedCourseId: l.courseId,
            customData: cleanCustomData(l.customData, studentFields),
            createdBy: ctx.staff.id,
          })
          .returning({ id: students.id });
        studentId = row!.id;
        created.set(l.phone, studentId);
      }
      let membershipId: string | null = null;
      if (g) {
        const [open] = await tx
          .select({ id: groupMemberships.id })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, g.id),
              eq(groupMemberships.studentId, studentId),
              isNull(groupMemberships.leftAt),
            ),
          );
        if (!open) {
          const [m] = await tx
            .insert(groupMemberships)
            .values({ groupId: g.id, studentId, status: "trial", enrolledAt: today, createdBy: ctx.staff.id })
            .returning({ id: groupMemberships.id });
          membershipId = m!.id;
        }
      }
      await tx
        .update(leads)
        .set({ stageId: won.id, stageChangedAt: new Date(), studentId, waitlistId: null })
        .where(eq(leads.id, l.id));
      await tx.insert(leadEvents).values({
        leadId: l.id,
        fromStageId: l.stageId,
        toStageId: won.id,
        actorId: ctx.staff.id,
        actorName: ctx.staff.name,
      });
      out.push({ leadId: l.id, name: l.name, studentId, existing: !isNew, membershipId });
    }
    if (extra) await extra(tx);
    return out;
  });

  for (const c of converted) {
    const l = list.find((x) => x.id === c.leadId)!;
    await ctx.audit(
      "lead.convert",
      { type: "lead", id: c.leadId },
      { name: c.name, studentId: c.studentId, existing: c.existing, ...(g ? { group: g.name } : {}) },
    );
    if (!c.existing)
      await ctx.audit(
        "student.create",
        { type: "student", id: c.studentId },
        { name: c.name, phone: formatPhone(l.phone), branchId: l.branchId, fromLead: c.leadId },
      );
    if (g && c.membershipId) {
      await ctx.audit(
        "group.enroll",
        { type: "group", id: g.id },
        { student: c.name, studentId: c.studentId, membershipId: c.membershipId },
      );
      await ctx.audit("student.enroll", { type: "student", id: c.studentId }, { group: g.name, groupId: g.id });
    }
  }
  return { ok: true, converted, group: g ? { id: g.id, name: g.name } : null };
}

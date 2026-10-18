import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { courses, groupMemberships, groups, smsDispatches, smsTemplates, students } from "@ventura/db/schema/tenant";
import { displayPhone, formatDate, money } from "@/lib/format";
import { type SmsVar, renderSms, splitName, templateVars } from "@/lib/sms-text";
import { getCenterSettings } from "../center";
import { getFinanceSettings, loadAccounts } from "../finance";
import { todayTashkent } from "../memberships";
import { enqueue, type OutboxItem } from "./outbox";

/*
 * Qo'lda yuborish (docs/EDU-CRM-SMS.md, 4.6): tanlangan o'quvchilarga shablon bo'yicha. Har o'quvchi uchun matn
 * o'z qiymatlari bilan to'ldiriladi (ism, guruh, qarz...). Kimga: ota-ona (raqami bo'lmasa — o'quvchi), o'quvchi
 * yoki ikkalasi. Hammasi bitta `sms_dispatches` yozuvi ostida navbatga tushadi; yuborishni fon vazifasi qiladi.
 */

export type SmsAudience = "student" | "parent" | "both";

export interface ManualSmsInput {
  templateId: string;
  audience: SmsAudience;
  studentIds: readonly string[];
  /** Guruh sahifasidan: {guruh} va {kurs} shu guruhdan */
  groupId?: string | null;
  /** Ommaviy yuborish nomi (jurnal va hisobot uchun) */
  title: string;
  createdBy: string;
}

export interface ManualSmsResult {
  dispatchId: string;
  queued: number;
  /** Raqami yo'q yoki noto'g'ri */
  skipped: number;
  templateName: string;
}

/** Kimga yuboriladi: standart — ota-ona, raqami bo'lmasa o'quvchi (Q3) */
export function recipientsFor(
  s: { phone: string; parentPhone: string | null },
  audience: SmsAudience,
): { recipient: "student" | "parent"; phone: string }[] {
  const parent = s.parentPhone?.trim() || null;
  if (audience === "student") return [{ recipient: "student", phone: s.phone }];
  if (audience === "parent")
    return [parent ? { recipient: "parent", phone: parent } : { recipient: "student", phone: s.phone }];
  const out: { recipient: "student" | "parent"; phone: string }[] = [{ recipient: "student", phone: s.phone }];
  if (parent && parent.replace(/\D/g, "") !== s.phone.replace(/\D/g, ""))
    out.push({ recipient: "parent", phone: parent });
  return out;
}

export async function sendManualSms(
  db: TenantDb,
  input: ManualSmsInput,
  centerName: string,
): Promise<ManualSmsResult | { error: "template" | "empty" }> {
  const [template] = await db
    .select()
    .from(smsTemplates)
    .where(and(eq(smsTemplates.id, input.templateId), isNull(smsTemplates.archivedAt)));
  if (!template) return { error: "template" };
  const ids = [...new Set(input.studentIds)];
  if (!ids.length) return { error: "empty" };

  const list = await db.select().from(students).where(inArray(students.id, ids));
  if (!list.length) return { error: "empty" };
  const used = new Set(templateVars(template.body));
  const today = todayTashkent();

  // Guruh: berilgan guruh yoki o'quvchining birinchi faol guruhi
  const memberships = await db
    .select({ studentId: groupMemberships.studentId, groupId: groups.id, group: groups.name, course: courses.name })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .where(
      and(
        inArray(groupMemberships.studentId, ids),
        input.groupId ? eq(groups.id, input.groupId) : undefined,
        inArray(groupMemberships.status, ["trial", "active", "paused"]),
      ),
    );
  const groupOf = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) if (!groupOf.has(m.studentId)) groupOf.set(m.studentId, m);

  // Qarz faqat shablonda {qarz} bo'lsa hisoblanadi (og'ir so'rov)
  const accounts = used.has("qarz") ? await loadAccounts(db, ids, today, await getFinanceSettings(db)) : null;
  const center = await getCenterSettings(db);
  const common: Partial<Record<SmsVar, string>> = {
    markaz: centerName,
    telefon: displayPhone(center.phone) ?? "",
    sana: formatDate(today),
  };

  const [dispatch] = await db
    .insert(smsDispatches)
    .values({ title: input.title.slice(0, 200), kind: template.kind, total: 0, createdBy: input.createdBy })
    .returning({ id: smsDispatches.id });

  const items: OutboxItem[] = [];
  let skipped = 0;
  for (const s of list) {
    const g = groupOf.get(s.id);
    const { first, last } = splitName(s.name);
    const summary = accounts?.get(s.id)?.summary;
    const text = renderSms(template.body, {
      ...common,
      ism: first,
      familiya: last,
      guruh: g?.group ?? "",
      kurs: g?.course ?? "",
      qarz: summary ? money(summary.debt + summary.otherDebt) : "",
    });
    const to = recipientsFor(s, input.audience);
    if (!to.length) skipped++;
    for (const r of to) {
      items.push({
        kind: template.kind,
        recipient: r.recipient,
        phone: r.phone,
        text,
        templateId: template.id,
        dispatchId: dispatch!.id,
        studentId: s.id,
        groupId: g?.groupId ?? input.groupId ?? null,
        branchId: s.branchId,
        createdBy: input.createdBy,
      });
    }
  }
  const queued = await enqueue(db, items);
  skipped += items.length - queued;
  await db.update(smsDispatches).set({ total: queued }).where(eq(smsDispatches.id, dispatch!.id));
  return { dispatchId: dispatch!.id, queued, skipped, templateName: template.name };
}

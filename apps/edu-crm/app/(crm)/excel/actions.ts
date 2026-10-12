"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type Permission, can } from "@ventura/auth/staff/policy";
import { FIELDS, type ImportTable, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/lib/excel";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { prepareImport, writeImport } from "@/lib/server/excel-import";
import { readSpreadsheet } from "@/lib/server/excel-read";
import { uz } from "@/lib/uz";

/*
 * Excel import (EDU-CRM-PLAN E1e, ADR 0013): fayl serverda o'qiladi (2 MB, 2000 qator), ustunlar brauzerda
 * tanlanadi, qatorlar serverda tekshiriladi va bitta tranzaksiyada yoziladi. Ruxsat — yaratish ruxsati.
 */

const TABLES = ["students", "groups", "teachers"] as const;
const FEATURE: Record<ImportTable, string> = { students: "students", groups: "groups", teachers: "teachers" };
const PERMISSION: Record<ImportTable, Permission> = {
  students: "students.create",
  groups: "groups.create",
  teachers: "staff.create",
};
const PATHS: Record<ImportTable, string[]> = {
  students: ["/students", "/groups"],
  groups: ["/groups", "/courses", "/rooms", "/teachers"],
  teachers: ["/teachers"],
};

export async function readExcelAction(form: FormData): Promise<ActionResult<{ rows: string[][] }>> {
  const table = z.enum(TABLES).safeParse(form.get("table"));
  if (!table.success) return { ok: false, error: uz.common.invalid };
  return crmAction<{ rows: string[][] }>(FEATURE[table.data], PERMISSION[table.data], async () => {
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: uz.excel.empty };
    if (!/\.(xlsx|csv)$/i.test(file.name)) return { ok: false, error: uz.excel.wrongType };
    if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: uz.excel.tooBig };
    const res = await readSpreadsheet(file.name, await file.arrayBuffer());
    if (!res.ok) {
      const error =
        res.reason === "too_many"
          ? uz.excel.tooMany(MAX_IMPORT_ROWS)
          : res.reason === "unreadable"
            ? uz.excel.unreadable
            : uz.excel.empty;
      return { ok: false, error };
    }
    return { ok: true, rows: res.rows };
  });
}

const importInput = z.object({
  table: z.enum(TABLES),
  branchId: z.uuid({ error: uz.excel.branchRequired }),
  rows: z
    .array(z.record(z.string(), z.string().max(300)))
    .min(1, uz.excel.nothing)
    .max(MAX_IMPORT_ROWS),
});

/** Qatorlarni tekshiradi; `commit` bo'lsa to'g'rilarini yozadi */
async function run(
  input: unknown,
  commit: boolean,
): Promise<ActionResult<{ errors: (string | null)[]; imported: number }>> {
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
  const { table, branchId, rows } = parsed.data;
  // O'quvchini guruhga yozish uchun guruhga qo'shish ruxsati ham kerak
  const needsGroup = table === "students" && rows.some((r) => (r.group ?? "").trim());
  return crmAction<{ errors: (string | null)[]; imported: number }>(FEATURE[table], PERMISSION[table], async (ctx) => {
    if (!ctx.branch.options.some((b) => b.id === branchId)) return { ok: false, error: uz.common.branchForbidden };
    if (needsGroup && !can(ctx.staff.access, "groups.add_student")) return { ok: false, error: uz.common.forbidden };
    const missing = FIELDS[table].find((f) => f.required && !rows.some((r) => (r[f.key] ?? "").trim()));
    if (missing) return { ok: false, error: uz.excel.missingRequired(missing.label) };

    const results = await prepareImport(table, { db: ctx.db, branchId }, rows);
    const errors = results.map((r) => r.error);
    if (!commit) return { ok: true, errors, imported: 0 };
    const valid = results.flatMap((r) => (r.prepared ? [r.prepared] : []));
    if (!valid.length) return { ok: false, error: uz.excel.nothing };
    const created = await writeImport(ctx.db, valid, ctx.staff.id);
    // Har yozuv o'z tarixiga (o'quvchi profilidagi Tarix), umumiy natija — bitta yozuv
    for (const c of created)
      await ctx.audit(`${c.type}.create`, { type: c.type, id: c.id }, { name: c.name, import: true });
    await ctx.audit(
      `import.${table}`,
      { type: "import", id: table },
      {
        branchId,
        imported: created.length,
        skipped: rows.length - created.length,
      },
    );
    for (const p of PATHS[table]) revalidatePath(p);
    return { ok: true, errors, imported: created.length };
  });
}

export async function checkImportAction(input: unknown) {
  return run(input, false);
}

export async function runImportAction(input: unknown) {
  return run(input, true);
}

import "server-only";
import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS } from "@/lib/excel";

/*
 * Yuklangan Excel/CSV faylni matn jadvaliga aylantirish (faqat birinchi varaq). Formula natijasi, boy matn,
 * havola va sana ham matnga: sana — YYYY-MM-DD (UTC qismlaridan, kun siljimaydi).
 */

const pad = (n: number) => String(n).padStart(2, "0");

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if ("richText" in v)
      return v.richText
        .map((t) => t.text)
        .join("")
        .trim();
    if ("result" in v) return cellText((v.result ?? null) as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
    if ("error" in v) return "";
  }
  return "";
}

/** CSV: vergul yoki nuqtali vergul ajratkichli, qo'shtirnoq ichidagi ajratkichlar hisobga olinadi */
function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

export type ReadResult = { ok: true; rows: string[][] } | { ok: false; reason: "empty" | "unreadable" | "too_many" };

export async function readSpreadsheet(name: string, data: ArrayBuffer): Promise<ReadResult> {
  let rows: string[][];
  try {
    if (/\.csv$/i.test(name)) {
      rows = parseCsv(new TextDecoder("utf-8").decode(data).replace(/^﻿/, ""));
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data);
      const ws = wb.worksheets[0];
      if (!ws) return { ok: false, reason: "empty" };
      rows = [];
      ws.eachRow({ includeEmpty: false }, (r) => {
        const values = Array.isArray(r.values) ? r.values.slice(1) : [];
        rows.push(values.map((v) => cellText((v ?? null) as ExcelJS.CellValue)));
      });
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  // To'liq bo'sh qatorlar tashlanadi, ustunlar soni tenglashtiriladi
  rows = rows.filter((r) => r.some((c) => c !== ""));
  if (!rows.length) return { ok: false, reason: "empty" };
  if (rows.length > MAX_IMPORT_ROWS + 1) return { ok: false, reason: "too_many" };
  const width = Math.min(40, Math.max(...rows.map((r) => r.length)));
  return { ok: true, rows: rows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").slice(0, 300))) };
}

import ExcelJS from "exceljs";
import { notFound } from "next/navigation";
import { type Permission, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { sheetName } from "@/lib/excel";
import { fieldText } from "@/lib/form-fields";
import { formatDate } from "@/lib/format";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups, openGroupsByStudent } from "../../groups/data";
import { getLeadFields, listLeads, listStages } from "../../leads/data";
import { listStudents } from "../../students/data";
import { listTeachers } from "../../teachers/data";

/*
 * Excel eksport va namuna shablon (EDU-CRM-PLAN E1e). Sarlavhalar import bilan bir xil — eksport qilingan fayl
 * qayta import qilinsa ustunlar o'zi taniladi (eski tizimda "Cost" kabi sarlavhalar narxni yo'qotar edi).
 * exceljs satrni har doim matn katagi qilib yozadi (formula faqat alohida obyekt bilan) — "=..." bilan boshlangan
 * ism formulaga aylanmaydi.
 */

const TABLES = {
  students: {
    feature: "students",
    view: ["students.view", "students.create", "students.edit"],
    file: "Oquvchilar",
    sheet: "O'quvchilar",
  },
  groups: {
    feature: "groups",
    view: ["groups.view", "groups.create", "groups.edit"],
    file: "Guruhlar",
    sheet: "Guruhlar",
  },
  teachers: {
    feature: "teachers",
    view: ["staff.view", "staff.create", "staff.edit"],
    file: "Ustozlar",
    sheet: "Ustozlar",
  },
  leads: {
    feature: "leads",
    view: ["leads.import_export"],
    file: "Lidlar",
    sheet: "Lidlar",
  },
} as const satisfies Record<string, { feature: string; view: readonly Permission[]; file: string; sheet: string }>;

const TEMPLATE: Record<keyof typeof TABLES, { headers: string[]; sample: string[][] }> = {
  students: {
    headers: [
      "O'quvchi F.I.SH",
      "Telefon raqami",
      "Guruh nomi",
      "Ota-onasi raqami",
      "Qo'shilgan sana",
      "Sinfi",
      "Izoh",
    ],
    sample: [
      ["Akromov Javohir", "+998 90 123 45 67", "", "+998 90 765 43 21", "01.09.2026", "9-sinf", ""],
      ["Toshmatova Dilnoza", "+998 93 222 33 44", "", "", "05.09.2026", "Talaba", ""],
    ],
  },
  groups: {
    headers: [
      "Guruh nomi",
      "Kurs nomi",
      "O'qituvchi",
      "Dars kunlari",
      "Xona",
      "Dars vaqti",
      "Boshlanish sanasi",
      "Oylik to'lov",
    ],
    sample: [
      [
        "Ingliz A1",
        "Ingliz tili",
        "Sardor Rustamov",
        "Du, Chor, Jum",
        "1-xona",
        "14:00 - 15:30",
        "01.09.2026",
        "400 000",
      ],
    ],
  },
  teachers: {
    headers: ["O'qituvchi F.I.SH", "Telefon raqami", "Tug'ilgan sana", "Maosh", "Izoh"],
    sample: [
      ["Sardor Rustamov", "+998 90 111 22 33", "12.05.1995", "40 [Foiz]", ""],
      ["Malika Karimova", "+998 91 444 55 66", "", "3 000 000 [Fiks]", ""],
    ],
  },
  leads: {
    headers: ["Ism familiya", "Telefon", "Qo'shimcha telefon", "Jinsi", "Manba", "Kurs", "Keyingi aloqa", "Izoh"],
    sample: [
      ["Aziz Karimov", "+998 90 123 45 67", "", "Erkak", "Instagram", "Ingliz tili", "20.10.2026", "Kechki guruh"],
      ["Madina Yusupova", "+998 93 222 33 44", "+998 91 555 66 77", "Ayol", "Tanish / Tavsiya", "", "", ""],
    ],
  },
};

const phone = (p: string) => (p ? `+998 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 7)} ${p.slice(7, 9)}` : "");
const days = (d: readonly string[]) =>
  d.map((x) => uz.weekdays.short[x as keyof typeof uz.weekdays.short] ?? x).join(", ");

async function rowsFor(table: keyof typeof TABLES, filter: readonly string[] | null) {
  const tenant = await requireTenant();
  const db = getTenantDb(tenant);
  const branchName = async () => {
    const ctx = await getBranchContext();
    return (id: string) => ctx.options.find((b) => b.id === id)?.name ?? "";
  };
  if (table === "students") {
    const list = await listStudents(db, filter);
    const groups = await openGroupsByStudent(
      db,
      list.map((s) => s.id),
    );
    return {
      headers: ["F.I.SH", "Telefon", "Ota-ona telefoni", "Guruhlar", "Holati", "Qo'shilgan vaqti"],
      rows: list.map((s) => [
        s.name,
        phone(s.phone),
        s.parentPhone ? phone(s.parentPhone) : "",
        // Bir nechta guruh — nuqtali vergul bilan (nomdagi vergul bo'linmaydi)
        (groups.get(s.id) ?? []).map((g) => g.name).join("; "),
        uz.students.status[s.status] ?? s.status,
        formatDate(s.joinedAt),
      ]),
    };
  }
  if (table === "groups") {
    const list = await listGroups(db, filter);
    return {
      headers: TEMPLATE.groups.headers.concat(["O'quvchilar soni"]),
      rows: list.map((g) => [
        g.name,
        g.courseName,
        g.teacherName,
        days(g.days),
        g.roomName ?? "",
        `${g.startTime} - ${g.endTime}`,
        formatDate(g.startDate),
        g.price,
        g.studentIds.length,
      ]),
    };
  }
  if (table === "leads") {
    const [list, stages, fields] = await Promise.all([listLeads(db, filter), listStages(db), getLeadFields(db)]);
    const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "";
    const gender = (g: string | null) => (g === "male" ? uz.students.male : g === "female" ? uz.students.female : "");
    const custom = fields.filter((f) => f.type !== "group");
    const text = (f: (typeof custom)[number], v: string | undefined) =>
      fieldText(f, v, { yes: uz.staff.yes, no: uz.staff.no, groupName: () => undefined }) ?? "";
    // Sarlavhalar import qoliplariga tushadi; "Bosqich", "Mas'ul" va qo'shimcha maydonlar importda o'tkazib yuboriladi
    return {
      headers: [...TEMPLATE.leads.headers, "Bosqich", "Mas'ul", "Qo'shilgan", ...custom.map((f) => f.label)],
      rows: list.map((l) => [
        l.name,
        phone(l.phone),
        l.phone2 ? phone(l.phone2) : "",
        gender(l.gender),
        l.source ?? "",
        l.courseName ?? "",
        l.targetDate ? formatDate(l.targetDate) : "",
        l.note ?? "",
        stageName(l.stageId),
        l.assignedName ?? "",
        formatDate(new Date(l.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" })),
        ...custom.map((f) => text(f, l.customData[f.id])),
      ]),
    };
  }
  const list = (await listTeachers(db, filter)).filter((t) => t.kind === "teacher");
  const name = await branchName();
  return {
    // "Maosh" importdagi ko'rinishda ("40 [Foiz]") — qayta import qilinsa o'zgarmaydi
    headers: ["O'qituvchi F.I.SH", "Telefon raqami", "Filial", "Tug'ilgan sana", "Maosh", "Izoh"],
    rows: list.map((t) => [
      t.name,
      phone(t.phone),
      name(t.branchId),
      t.birthDate ? formatDate(t.birthDate) : "",
      t.salaryType === "percent"
        ? `${t.revenueSharePercent} [Foiz]`
        : t.salaryType === "fixed"
          ? `${t.fixedSalary} [Fiks]`
          : `${t.perStudentSalary} [O'quvchi]`,
      t.note ?? "",
    ]),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!(table in TABLES)) notFound();
  const key = table as keyof typeof TABLES;
  const conf = TABLES[key];
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, conf.feature))) notFound();
  const staff = await requireStaff();
  if (!canAny(staff.access, conf.view)) return new Response(uz.common.forbidden, { status: 403 });

  const template = new URL(req.url).searchParams.get("template") === "1";
  const branch = await getBranchContext();
  const data = template ? TEMPLATE[key] : await rowsFor(key, branch.filter);
  const body = template ? TEMPLATE[key].sample : (data as { rows: (string | number)[][] }).rows;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName(template ? `${conf.sheet} namuna` : conf.sheet, new Set()));
  ws.addRow(data.headers).font = { bold: true };
  for (const r of body) ws.addRow(r);
  ws.columns.forEach((c) => (c.width = 24));
  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const file = template ? `${conf.file}_namuna.xlsx` : `${conf.file}_${stamp}.xlsx`;
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}

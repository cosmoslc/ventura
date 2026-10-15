import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  KNOWN_ACTIONS,
  MIRROR_ACTIONS,
  deviceLabel,
  describeAction,
  isKnownAction,
  safeMetadata,
  sectionActionIds,
  sectionOf,
} from "./activity-log";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN = [ROOT, join(ROOT, "../../packages/auth/src/staff")];
const SKIP = new Set(["node_modules", ".next", "zz-preview", "e2e", ".tmp"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Kodda jurnalga yoziladigan kalitlar: `audit("x", ...)`, `ctx.audit(...)` va `tenantAudit.record(db, { action: "x" })` */
function usedActions() {
  const literals = new Set<string>();
  const templates = new Set<string>();
  const add = (expr: string) => {
    for (const m of expr.matchAll(/"([^"]+)"|`([^`]+)`/g)) {
      const v = (m[1] ?? m[2])!;
      (v.includes("${") ? templates : literals).add(v);
    }
  };
  for (const root of SCAN) {
    for (const file of walk(root)) {
      // Izohlardagi tilga olinishlar hisobga olinmaydi
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const m of src.matchAll(/\baudit\(\s*([^,]+?)\s*,/g)) add(m[1]!);
      for (const m of src.matchAll(/(?:tenantAudit|audit)\.record\(/g)) {
        const head = src.slice(m.index, m.index + 500);
        const a = head.match(/\baction:\s*("[^"]+"|`[^`]+`)/);
        if (a) add(a[1]!);
      }
    }
  }
  return { literals, templates };
}

// Shablonli kalitlar va ular qabul qiladigan qiymatlar (kodda: excel/actions.ts, groups/actions.ts)
const TEMPLATES: Record<string, string[]> = {
  "group.${action}": ["group.activate", "group.pause", "group.unpause", "group.leave"],
  "student.${action}": ["student.activate", "student.pause", "student.unpause", "student.leave"],
  "import.${table}": ["import.students", "import.groups", "import.teachers", "import.leads"],
  "${c.type}.create": ["student.create", "group.create", "teacher.create", "lead.create"],
};

describe("faoliyat jurnali reyestri", () => {
  it("kodda yoziladigan har bir kalit reyestrda bor", () => {
    const { literals } = usedActions();
    expect(literals.size).toBeGreaterThan(80);
    const missing = [...literals].filter((a) => !isKnownAction(a)).sort();
    expect(missing).toEqual([]);
  });

  it("shablonli kalitlar ma'lum ro'yxatda va ularning qiymatlari reyestrda", () => {
    const { templates } = usedActions();
    expect([...templates].filter((t) => !(t in TEMPLATES))).toEqual([]);
    for (const list of Object.values(TEMPLATES)) for (const a of list) expect(isKnownAction(a)).toBe(true);
  });

  it("reyestrda kodda ishlatilmaydigan kalit yo'q (o'lik yozuv)", () => {
    const { literals } = usedActions();
    const expanded = new Set([...literals, ...Object.values(TEMPLATES).flat()]);
    expect(KNOWN_ACTIONS.filter((a) => !expanded.has(a)).sort()).toEqual([]);
  });

  it("ildiz papka to'g'ri topilgan", () => {
    expect(relative(ROOT, join(ROOT, "lib"))).toBe("lib");
  });
});

describe("describeAction", () => {
  it("to'lov jumlasi: kim, summa, o'quvchi", () => {
    expect(
      describeAction("payment.create", "Aziz Karimov", { metadata: { amount: 300000 }, targetName: "Ali Valiyev" }),
    ).toBe("Aziz Karimov to'lov qabul qildi: 300 000 so'm — Ali Valiyev");
  });

  it("tizim amali (xodimsiz)", () => {
    expect(describeAction("lead.apply", null, { metadata: { name: "Vali" } })).toBe(
      "Tizim saytdan ariza qoldirdi — Vali",
    );
  });

  it("nom metadata'da bo'lmasa, bazadagi nishon nomi olinadi", () => {
    expect(describeAction("student.archive", "A", { metadata: { reason: "ko'chdi" }, targetName: "Ali" })).toBe(
      "A o'quvchini arxivga oldi: ko'chdi — Ali",
    );
  });

  it("guruhga qo'shish: guruh nomi nishondan, o'quvchi tafsilotda", () => {
    expect(describeAction("group.enroll", "A", { metadata: { student: "Ali" }, targetName: "Ingliz A1" })).toBe(
      "A guruhga o'quvchi qo'shdi: Ali — Ingliz A1",
    );
  });

  it("o'zgartirish yozuvida summa after/before ichidan olinadi", () => {
    expect(
      describeAction("expense.update", "A", { metadata: { before: { amount: 1 }, after: { amount: 25000 } } }),
    ).toBe("A xarajatni tahrirladi: 25 000 so'm");
  });

  it("Excel import: holat va soni", () => {
    expect(describeAction("import.students", "A", { metadata: { imported: 12, skipped: 2 } })).toBe(
      "A Excel'dan import qildi: 12 ta o'quvchi, 2 tasi o'tkazib yuborildi",
    );
  });

  it("noma'lum kalit umumiy jumla bilan chiqadi, yiqilmaydi", () => {
    expect(describeAction("yangi.amal", "A", { metadata: null })).toBe("A «yangi.amal» amalini bajardi");
    expect(isKnownAction("yangi.amal")).toBe(false);
  });
});

describe("bo'limlar", () => {
  it("ma'lum va noma'lum kalit bo'limi", () => {
    expect(sectionOf("payment.void")).toBe("payment");
    expect(sectionOf("lead.yangi")).toBe("lead");
    expect(sectionOf("butunlay.boshqa")).toBe("other");
  });

  it("'boshqa' bo'limi barcha bilinganlarni inkor qiladi", () => {
    const other = sectionActionIds("other");
    expect(other.negate).toBe(true);
    expect(other.ids).toEqual([...KNOWN_ACTIONS]);
    expect(sectionActionIds("payment").ids).toContain("payment.create");
  });

  it("aks yozuvlar (student.enroll...) ro'yxatdan chiqarib tashlanadi, group.* esa qoladi", () => {
    expect(MIRROR_ACTIONS).toContain("student.enroll");
    expect(MIRROR_ACTIONS).not.toContain("group.enroll");
  });
});

describe("tafsilot", () => {
  it("sir nomli kalitlar yashiriladi, ichma-ich qiymatda ham", () => {
    const d = safeMetadata({ name: "A", password: "x", token: "y", nested: { otp: "123456", ok: 1 } });
    expect(d.find((x) => x.key === "Nomi")?.value).toBe("A");
    expect(d.find((x) => x.key === "password")?.value).toBe("•••");
    expect(d.find((x) => x.key === "token")?.value).toBe("•••");
    expect(d.find((x) => x.key === "nested")?.value).toBe('{"otp":"•••","ok":1}');
  });

  it("bo'sh metadata", () => {
    expect(safeMetadata(null)).toEqual([]);
    expect(safeMetadata({})).toEqual([]);
  });

  it("qurilma nomi", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      ),
    ).toBe("Chrome · Windows");
    expect(deviceLabel(null)).toBeNull();
  });
});

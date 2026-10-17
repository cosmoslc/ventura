import { describe, expect, it } from "vitest";
import {
  type FunnelLead,
  bestSource,
  biggestDrop,
  countShare,
  funnelKpis,
  funnelSteps,
  matchesFunnelFilter,
  parseHiddenStages,
  visibleIndexes,
  monthAdvice,
  seasonMonths,
  sourceRows,
  stageDays,
} from "./lead-reports";

const lead = (reached: number, kind: FunnelLead["kind"] = "open", staffId: string | null = null): FunnelLead => ({
  staffId,
  kind,
  reached,
});

describe("CRM voronka", () => {
  // 3 ochiq bosqich + o'quvchi bo'ldi (3)
  const leads = [lead(0), lead(0, "lost"), lead(1), lead(2, "lost"), lead(3, "won"), lead(3, "won")];
  const steps = funnelSteps(leads, 3);

  it("har pog'onaga yetganlar, ulush, o'tish va qolib ketganlar", () => {
    expect(steps.map((s) => s.count)).toEqual([6, 4, 3, 2]);
    expect(steps[0]).toMatchObject({ share: 100, conv: 100, drop: 0 });
    expect(steps[1]).toMatchObject({ conv: (4 / 6) * 100, drop: 2 });
    expect(steps[3]).toMatchObject({ share: (2 / 6) * 100, drop: 1 });
    expect(funnelSteps([], 2)[0]).toMatchObject({ count: 0, share: null, conv: null });
  });

  it("eng katta tushish — oldingi pog'onaga nisbatan", () => {
    // 6→4 (33%), 4→3 (25%), 3→2 (33.3%) — birinchisi tanlanadi
    expect(biggestDrop(steps)).toEqual({ index: 1, from: 0, rate: (2 / 6) * 100 });
    expect(biggestDrop(funnelSteps([lead(3, "won")], 3))).toBeNull();
  });

  it("yashirilgan bosqich o'tkazib yuboriladi: o'tish va tushish ko'rinadigan oldingi pog'onaga nisbatan", () => {
    const visible = visibleIndexes(3, new Set([1]));
    expect(visible).toEqual([0, 2, 3]);
    const hidden = funnelSteps(leads, 3, visible);
    expect(hidden.map((s) => [s.index, s.count])).toEqual([
      [0, 6],
      [2, 3],
      [3, 2],
    ]);
    expect(hidden[1]).toMatchObject({ conv: 50, drop: 3 });
    expect(biggestDrop(hidden)).toEqual({ index: 2, from: 0, rate: 50 });
    // Oxirgi pog'ona hech qachon yashirilmaydi
    expect(visibleIndexes(2, new Set([0, 1, 2]))).toEqual([2]);
  });

  it("ko'rsatkichlar tanlangan pog'ona bo'yicha: yetmaganlar, ulardan yo'qotilganlar, o'tmaganlar", () => {
    // 2-pog'ona: 3 ta yetgan → 3 ta yetmagan, ulardan 1 tasi (reached 0, lost) shu yerda yo'qotilgan
    expect(funnelKpis(leads, steps, 2)).toEqual({
      total: 6,
      won: 2,
      conversion: (2 / 6) * 100,
      notReached: 3,
      lostBefore: 1,
      notPassed: 1,
    });
    // Tanlanmasa (oxirgi pog'ona): 4 ta o'quvchi bo'lmagan, ulardan 2 tasi yo'qotilgan
    expect(funnelKpis(leads, steps, 3)).toMatchObject({ notReached: 4, lostBefore: 2, notPassed: 1 });
    expect(funnelKpis([], funnelSteps([], 3), 3)).toMatchObject({ total: 0, conversion: null, notReached: 0 });
  });

  it("yashirin bosqichlar sozlamasi: buzilgan qiymat — hech biri yashirilmagan", () => {
    expect(parseHiddenStages(["a", "a", 5, "", "b"])).toEqual(["a", "b"]);
    expect(parseHiddenStages("x")).toEqual([]);
    expect(parseHiddenStages(null)).toEqual([]);
  });

  it("ro'yxat filtri: bosqich, mas'ul (yoki biriktirilmagan) va ism / telefon qidiruvi", () => {
    const l = { name: "Aziza Karimova", phone: "901234567", staffId: "u1", reached: 1 };
    const all = { q: "", staff: null, reached: null };
    expect(matchesFunnelFilter(l, all)).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, reached: 1 })).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, reached: 2 })).toBe(false);
    expect(matchesFunnelFilter(l, { ...all, staff: "u1" })).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, staff: "u2" })).toBe(false);
    expect(matchesFunnelFilter(l, { ...all, staff: "none" })).toBe(false);
    expect(matchesFunnelFilter({ ...l, staffId: null }, { ...all, staff: "none" })).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, q: "karim" })).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, q: "+998 90 123" })).toBe(true);
    expect(matchesFunnelFilter(l, { ...all, q: "xyz" })).toBe(false);
  });

  it("bosqichda o'rtacha turish — faqat tugallangan turishlar", () => {
    const d = 86_400_000;
    const days = stageDays([
      { leadId: "a", toStageId: "s1", at: 0 },
      { leadId: "a", toStageId: "s2", at: 2 * d },
      { leadId: "b", toStageId: "s1", at: 10 * d },
      { leadId: "b", toStageId: "s2", at: 14 * d },
      // s2 da hali turibdi — hisobga kirmaydi
    ]);
    expect(days.get("s1")).toBe(3);
    expect(days.has("s2")).toBe(false);
  });
});

describe("sabablar, manbalar", () => {
  it("ko'pidan kamiga, teng bo'lsa alifbo bo'yicha", () => {
    expect(countShare(["b", "a", "b", "c"])).toEqual([
      { key: "b", count: 2, share: 50 },
      { key: "a", count: 1, share: 25 },
      { key: "c", count: 1, share: 25 },
    ]);
  });

  it("manba bo'yicha holatlar, konversiya va tushum; eng samarali — kamida 5 lid", () => {
    const rows = sourceRows([
      ...Array.from({ length: 5 }, (_, i) => ({
        source: "Instagram",
        kind: (i < 2 ? "won" : i < 4 ? "open" : "lost") as "won" | "open" | "lost",
        revenue: i < 2 ? 100 : 0,
      })),
      { source: "Telegram", kind: "won", revenue: 50 },
    ]);
    expect(rows[0]).toEqual({ source: "Instagram", leads: 5, open: 2, won: 2, lost: 1, conv: 40, revenue: 200 });
    // Telegram 100% — lekin 1 ta lid
    expect(bestSource(rows)?.source).toBe("Instagram");
    expect(bestSource(rows.slice(1))).toBeNull();
  });
});

describe("mavsumiy oqim", () => {
  it("oylar: lidlar, o'tgan yil, o'quvchi bo'lganlar, yangi o'quvchilar; kelmagan oy", () => {
    const months = seasonMonths(
      [
        { month: "2026-03", won: true },
        { month: "2026-03", won: false },
        { month: "2025-03", won: false },
      ],
      ["2026-03", "2026-04"],
      2026,
      "2026-10-14",
    );
    expect(months[2]).toEqual({
      month: "2026-03",
      future: false,
      leads: 2,
      prevLeads: 1,
      won: 1,
      conv: 50,
      newStudents: 1,
    });
    expect(months[10]!.future).toBe(true);
  });

  it("reklama oylari: kam ma'lumotda yo'q; cho'qqi, undan oldingi oy va eng kam oylar", () => {
    expect(monthAdvice(["2026-01", "2026-02"])).toBeNull();
    const data = [
      ...Array(9).fill("2025-09"),
      ...Array(7).fill("2025-08"),
      ...Array(3).fill("2025-07"),
      ...Array(2).fill("2025-05"),
      ...Array(4).fill("2025-10"),
      ...Array(5).fill("2026-09"),
    ];
    const a = monthAdvice(data)!;
    // Sentyabr o'rtacha (9 + 5) / 2 = 7, avgust 7 — teng bo'lsa oldingi oy
    expect(a[8]).toMatchObject({ avg: 7, years: 2, tag: "peak" });
    expect(a[7]!.tag).toBe("peak");
    expect(a[6]!.tag).toBe("boost");
    // Lid bo'lmagan oylar (0) — eng kam
    expect(a.filter((x) => x.tag === "save").map((x) => x.month)).toEqual([11, 12]);
  });
});

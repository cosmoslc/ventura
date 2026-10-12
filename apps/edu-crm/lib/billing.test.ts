import { describe, expect, it } from "vitest";
import {
  type BillingGroup,
  type BillingMembership,
  type ChargeContext,
  type Discount,
  DEFAULT_BILLING,
  type Mark,
  billingMonths,
  discountedPrice,
  membershipCharges,
  monthCharge,
  priceForMonth,
  scheduledDates,
} from "./billing";

/*
 * Qo'lda hisoblangan misollar. Oktyabr 2026: 1-oktyabr — payshanba.
 * Du/Ch/Ju guruhi: Du 5,12,19,26 · Ch 7,14,21,28 · Ju 2,9,16,23,30 — 13 dars.
 */

const group: BillingGroup = {
  id: "g1",
  branchId: "b1",
  days: ["mon", "wed", "fri"],
  startDate: "2026-01-10",
  prices: [{ fromMonth: "2026-01", price: 300_000 }],
};
const member = (over: Partial<BillingMembership> = {}): BillingMembership => ({
  id: "m1",
  groupId: "g1",
  activatedAt: "2026-09-01",
  leftAt: null,
  pauses: [],
  ...over,
});
const ctx = (over: Partial<ChargeContext> = {}): ChargeContext => ({
  holidays: [],
  marks: new Map(),
  discounts: [],
  settings: DEFAULT_BILLING,
  ...over,
});
const marks = (o: Record<string, Mark>) => new Map(Object.entries(o).map(([d, s]) => [`2026-10-${d}`, s]));
const OCT = "2026-10";

describe("dars sanalari", () => {
  it("oktyabr 2026, Du/Ch/Ju — 13 dars", () => {
    expect(scheduledDates(group.days, OCT)).toEqual([
      "2026-10-02",
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
      "2026-10-26",
      "2026-10-28",
      "2026-10-30",
    ]);
  });
});

describe("oylik rejim", () => {
  it("butun oy faol — to'liq narx", () => {
    expect(monthCharge(member(), group, OCT, ctx())).toMatchObject({ lessons: 13, billable: 13, amount: 300_000 });
  });

  it("14-oktyabrda faollashgan — 8/13 (eski tizimdagi misol bilan bir xil: 184 615)", () => {
    const c = monthCharge(member({ activatedAt: "2026-10-14" }), group, OCT, ctx());
    expect(c).toMatchObject({ billable: 8, charged: 8, amount: 184_615 });
  });

  it("bayram darsi oylik to'lovdan chiqadi: 12/13 = 276 923", () => {
    const holidays = [{ startDate: "2026-10-09", endDate: "2026-10-09", branchIds: null, affectsLessons: true }];
    expect(monthCharge(member(), group, OCT, ctx({ holidays }))).toMatchObject({
      lessons: 13,
      billable: 12,
      amount: 276_923,
    });
  });

  it("boshqa filial bayrami va darsga ta'sir qilmaydigan bayram hisobga olinmaydi", () => {
    const holidays = [
      { startDate: "2026-10-09", endDate: "2026-10-09", branchIds: ["b2"], affectsLessons: true },
      { startDate: "2026-10-12", endDate: "2026-10-12", branchIds: null, affectsLessons: false },
    ];
    expect(monthCharge(member(), group, OCT, ctx({ holidays })).amount).toBe(300_000);
  });

  it("sababli qoldirilgan 2 dars chiqariladi: 11/13 = 253 846", () => {
    const c = monthCharge(
      member(),
      group,
      OCT,
      ctx({ marks: marks({ "07": "excused", "09": "excused", "12": "absent" }) }),
    );
    expect(c).toMatchObject({ billable: 13, excused: 2, charged: 11, amount: 253_846 });
  });

  it("sozlamada o'chirilsa sababli dars ham to'lanadi", () => {
    const c = monthCharge(
      member(),
      group,
      OCT,
      ctx({
        marks: marks({ "07": "excused" }),
        settings: { mode: "monthly", excusedRefund: false },
      }),
    );
    expect(c).toMatchObject({ excused: 0, amount: 300_000 });
  });

  it("muzlatilgan oraliq [12, 19) — 12, 14, 16 hisoblanmaydi: 10/13 = 230 769", () => {
    const c = monthCharge(member({ pauses: [{ from: "2026-10-12", to: "2026-10-19" }] }), group, OCT, ctx());
    expect(c).toMatchObject({ billable: 10, amount: 230_769 });
  });

  it("hali tugamagan muzlatish oy oxirigacha amal qiladi", () => {
    const c = monthCharge(member({ pauses: [{ from: "2026-10-26", to: null }] }), group, OCT, ctx());
    // 26, 28, 30 — muzlatilgan
    expect(c).toMatchObject({ billable: 10, amount: 230_769 });
  });

  it("16-oktyabrda chiqqan — 16 kuni hisoblanmaydi: 6/13 = 138 462", () => {
    const c = monthCharge(member({ leftAt: "2026-10-16" }), group, OCT, ctx());
    expect(c).toMatchObject({ billable: 6, amount: 138_462 });
  });

  it("guruh oy o'rtasida boshlangan: 15-oktyabrdan — 7/13 = 161 538", () => {
    const c = monthCharge(member({ activatedAt: "2026-10-01" }), { ...group, startDate: "2026-10-15" }, OCT, ctx());
    expect(c).toMatchObject({ billable: 7, amount: 161_538 });
  });

  it("sababli dars hisobdagi sanalardan tashqarida bo'lsa chiqarilmaydi", () => {
    const c = monthCharge(
      member({ activatedAt: "2026-10-14" }),
      group,
      OCT,
      ctx({ marks: marks({ "07": "excused" }) }),
    );
    expect(c).toMatchObject({ billable: 8, excused: 0, amount: 184_615 });
  });

  it("sinovdagi a'zo (faollashtirilmagan) — 0", () => {
    expect(monthCharge(member({ activatedAt: null }), group, OCT, ctx()).amount).toBe(0);
  });
});

describe("dars rejimi", () => {
  const perLesson = (excusedRefund: boolean) => ({ mode: "per_lesson" as const, excusedRefund });
  const m = marks({ "02": "present", "05": "late", "07": "absent", "09": "excused" });

  it("bor, kech va sababsiz yo'q to'lanadi; belgilanmagan dars to'lanmaydi: 3/13 = 69 231", () => {
    expect(monthCharge(member(), group, OCT, ctx({ marks: m, settings: perLesson(true) }))).toMatchObject({
      charged: 3,
      amount: 69_231,
    });
  });

  it("sababli dars sozlama o'chiq bo'lsa to'lanadi: 4/13 = 92 308", () => {
    expect(monthCharge(member(), group, OCT, ctx({ marks: m, settings: perLesson(false) })).amount).toBe(92_308);
  });

  it("faollashtirishdan oldingi belgilar to'lanmaydi", () => {
    const c = monthCharge(
      member({ activatedAt: "2026-10-07" }),
      group,
      OCT,
      ctx({ marks: m, settings: perLesson(true) }),
    );
    expect(c.charged).toBe(1);
  });
});

describe("narx va chegirma", () => {
  it("narx tarixi: tanlangan oydan boshlab", () => {
    const prices = [
      { fromMonth: "2026-11", price: 350_000 },
      { fromMonth: "2026-09", price: 300_000 },
    ];
    expect(priceForMonth(prices, "2026-08")).toBe(300_000);
    expect(priceForMonth(prices, "2026-10")).toBe(300_000);
    expect(priceForMonth(prices, "2026-11")).toBe(350_000);
    expect(priceForMonth(prices, "2027-03")).toBe(350_000);
    expect(priceForMonth([], "2026-10")).toBe(0);
  });

  it("narx o'zgarishi o'tgan oyni o'zgartirmaydi", () => {
    const g = {
      ...group,
      prices: [
        { fromMonth: "2026-01", price: 300_000 },
        { fromMonth: "2026-11", price: 400_000 },
      ],
    };
    expect(monthCharge(member(), g, "2026-10", ctx()).amount).toBe(300_000);
    expect(monthCharge(member(), g, "2026-11", ctx()).basePrice).toBe(400_000);
  });

  const d = (o: Partial<Discount>): Discount => ({
    id: "d",
    groupId: null,
    kind: "fixed",
    value: 0,
    fromMonth: "2026-01",
    toMonth: null,
    affectsTeacher: true,
    ...o,
  });

  it("chegirmalar asosiy narxdan qo'shilib ayiriladi: 300 000 − 20% − 50 000 = 190 000", () => {
    const discounts = [d({ kind: "percent", value: 20 }), d({ value: 50_000 })];
    expect(monthCharge(member(), group, OCT, ctx({ discounts }))).toMatchObject({
      basePrice: 300_000,
      fullPrice: 190_000,
      amount: 190_000,
    });
  });

  it("chegirma muddati, boshqa guruh chegirmasi hisobga olinmaydi", () => {
    const discounts = [
      d({ value: 10_000, fromMonth: "2026-11" }),
      d({ value: 20_000, toMonth: "2026-09" }),
      d({ value: 30_000, groupId: "g2" }),
      d({ value: 40_000, groupId: "g1", fromMonth: "2026-10", toMonth: "2026-10" }),
    ];
    expect(monthCharge(member(), group, OCT, ctx({ discounts })).fullPrice).toBe(260_000);
  });

  it("chegirma narxdan katta bo'lsa 0, chegirma pro-rataga ham qo'llanadi", () => {
    expect(discountedPrice(300_000, [d({ value: 500_000 })])).toBe(0);
    const c = monthCharge(
      member({ activatedAt: "2026-10-14" }),
      group,
      OCT,
      ctx({ discounts: [d({ kind: "percent", value: 50 })] }),
    );
    // 150 000 × 8/13 = 92 307.69
    expect(c.amount).toBe(92_308);
  });

  it("o'qituvchi ulushiga ta'sir qilmaydigan chegirma teacherOnly da chiqarilmaydi", () => {
    const list = [d({ kind: "percent", value: 20, affectsTeacher: false }), d({ value: 10_000 })];
    expect(discountedPrice(500_000, list)).toBe(390_000);
    expect(discountedPrice(500_000, list, { teacherOnly: true })).toBe(490_000);
  });

  it("foiz chegirma yaxlitlanadi: 333 333 × 15% = 283 333.05 → 283 333", () => {
    expect(discountedPrice(333_333, [d({ kind: "percent", value: 15 })])).toBe(283_333);
  });
});

describe("hisob oylari", () => {
  it("faollashtirilgan oydan joriy oygacha", () => {
    expect(billingMonths(member({ activatedAt: "2026-08-20" }), group, "2026-10")).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("chiqqan kun oy boshida bo'lsa, o'sha oy hisoblanmaydi", () => {
    expect(billingMonths(member({ activatedAt: "2026-08-20", leftAt: "2026-10-01" }), group, "2026-10")).toEqual([
      "2026-08",
      "2026-09",
    ]);
    expect(billingMonths(member({ activatedAt: "2026-08-20", leftAt: "2026-09-15" }), group, "2026-12")).toEqual([
      "2026-08",
      "2026-09",
    ]);
  });

  it("sinovdagi a'zo uchun oy yo'q; guruh keyin boshlangan bo'lsa guruh oyidan", () => {
    expect(billingMonths(member({ activatedAt: null }), group, OCT)).toEqual([]);
    expect(
      billingMonths(member({ activatedAt: "2026-08-01" }), { ...group, startDate: "2026-10-15" }, "2026-11"),
    ).toEqual(["2026-10", "2026-11"]);
  });

  it("kelajakda faollashadigan a'zo hozircha hisoblanmaydi", () => {
    expect(billingMonths(member({ activatedAt: "2026-11-02" }), group, OCT)).toEqual([]);
  });

  it("uch oylik hisob: avgust 14-dan, sentabr to'liq, oktyabr bayram bilan", () => {
    const holidays = [{ startDate: "2026-10-09", endDate: "2026-10-09", branchIds: null, affectsLessons: true }];
    const list = membershipCharges(member({ activatedAt: "2026-08-14" }), group, OCT, ctx({ holidays }));
    // Avgust 2026: 1-avgust shanba. Du 3,10,17,24,31 · Ch 5,12,19,26 · Ju 7,14,21,28 = 13; 14-dan: 14,17,19,21,24,26,28,31 = 8
    expect(list.map((c) => [c.month, c.lessons, c.billable, c.amount])).toEqual([
      ["2026-08", 13, 8, 184_615],
      // Sentabr: 1-sentabr seshanba. Du 7,14,21,28 · Ch 2,9,16,23,30 · Ju 4,11,18,25 = 13
      ["2026-09", 13, 13, 300_000],
      ["2026-10", 13, 12, 276_923],
    ]);
  });
});

/**
 * Sawmill foyda va moliyaviy tahlil hisob-kitoblari moduli.
 * SAWMILL-TAHLIL 8 va 12-bo'limlari (K11, K14) asosida.
 */

export interface TerakFinancialInputs {
  purchasePrice: number;
  additionalCosts: number; // terak_costs yig'indisi (transport, res, mashina, boshqa)
  workCosts: number; // terak bo'yicha ishlangan barcha ish haqi
  dispatchRevenue: number; // yuk chiqarishdan olingan daromad
  stockValue: number; // ombordagi qolgan materiallar qiymati
}

export interface TerakProfitResult {
  totalCosts: number; // Xarid + Qo'shimcha xarajatlar + Ish haqi
  dispatchRevenue: number;
  stockValue: number;
  profitEstimated: number; // Taxminiy foyda = Daromad + Ombor qiymati - Xarajatlar
  profitReal: number; // Haqiqiy foyda = Daromad - Xarajatlar
  marginEstimated: number; // Foizda (%)
  marginReal: number; // Foizda (%)
}

/**
 * Bitta terak bo'yicha foyda va rentabellikni hisoblaydi.
 */
export function calculateTerakProfit(inputs: TerakFinancialInputs): TerakProfitResult {
  const { purchasePrice, additionalCosts, workCosts, dispatchRevenue, stockValue } = inputs;

  const totalCosts = Math.round(purchasePrice + additionalCosts + workCosts);
  const revenue = Math.round(dispatchRevenue);
  const stockVal = Math.round(stockValue);

  const profitEstimated = revenue + stockVal - totalCosts;
  const profitReal = revenue - totalCosts;

  const totalExpectedRevenue = revenue + stockVal;
  const marginEstimated =
    totalExpectedRevenue > 0 ? Math.round((profitEstimated / totalExpectedRevenue) * 1000) / 10 : 0;

  const marginReal = revenue > 0 ? Math.round((profitReal / revenue) * 1000) / 10 : 0;

  return {
    totalCosts,
    dispatchRevenue: revenue,
    stockValue: stockVal,
    profitEstimated,
    profitReal,
    marginEstimated,
    marginReal,
  };
}

export interface OverallProfitInputs {
  terakProfits: TerakProfitResult[];
  generalExpenses: number; // K14: terakka bog'lanmagan umumiy xarajatlar
  profitMethod: "estimated" | "real";
}

export interface OverallProfitResult {
  terakCostsTotal: number;
  dispatchRevenueTotal: number;
  stockValueTotal: number;
  generalExpensesTotal: number;
  allCostsTotal: number; // terak xarajatlari + umumiy xarajatlar
  profitEstimated: number; // Barcha teraklar taxminiy foydasi - umumiy xarajatlar
  profitReal: number; // Barcha teraklar haqiqiy foydasi - umumiy xarajatlar
  effectiveProfit: number; // Tanlangan usul bo'yicha yakuniy foyda
}

/**
 * Barcha teraklar va korxona umumiy foydasini hisoblaydi (K14: umumiy xarajatlar ayirilgan holda).
 */
export function calculateOverallProfit(inputs: OverallProfitInputs): OverallProfitResult {
  const { terakProfits, generalExpenses, profitMethod } = inputs;

  let terakCostsTotal = 0;
  let dispatchRevenueTotal = 0;
  let stockValueTotal = 0;
  let profitEstimatedBeforeGen = 0;
  let profitRealBeforeGen = 0;

  for (const tp of terakProfits) {
    terakCostsTotal += tp.totalCosts;
    dispatchRevenueTotal += tp.dispatchRevenue;
    stockValueTotal += tp.stockValue;
    profitEstimatedBeforeGen += tp.profitEstimated;
    profitRealBeforeGen += tp.profitReal;
  }

  const generalExpensesTotal = Math.round(generalExpenses);
  const allCostsTotal = terakCostsTotal + generalExpensesTotal;

  // K14: Umumiy xarajatlar umumiy foydadan ayriladi
  const profitEstimated = profitEstimatedBeforeGen - generalExpensesTotal;
  const profitReal = profitRealBeforeGen - generalExpensesTotal;
  const effectiveProfit = profitMethod === "estimated" ? profitEstimated : profitReal;

  return {
    terakCostsTotal,
    dispatchRevenueTotal,
    stockValueTotal,
    generalExpensesTotal,
    allCostsTotal,
    profitEstimated,
    profitReal,
    effectiveProfit,
  };
}

export interface DispatchDayData {
  date: string; // YYYY-MM-DD
  quantity: number; // donada
  totalAmount: number; // so'mda
}

export interface WeeklyChartBar {
  date: string; // YYYY-MM-DD
  dayLabelUz: string;
  dayLabelRu: string;
  quantityPiece: number;
  totalAmount: number;
  isToday: boolean;
}

const DOW_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Juma", "Shan"];
const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/**
 * K11: Oxirgi 7 kunlik yuk chiqarish grafigi ma'lumotlarini to'g'ri ajratib shakllantiradi.
 */
export function calculateWeeklyChart(dispatches: DispatchDayData[], today: Date = new Date()): WeeklyChartBar[] {
  const bars: WeeklyChartBar[] = [];

  // Oxirgi 7 kun (6 kun avvaldan bugungacha)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const dow = d.getDay();

    const matching = dispatches.filter((dp) => dp.date === dateStr);
    const totalQty = matching.reduce((acc, dp) => acc + Number(dp.quantity), 0);
    const totalAmt = matching.reduce((acc, dp) => acc + Number(dp.totalAmount), 0);

    bars.push({
      date: dateStr,
      dayLabelUz: DOW_UZ[dow] ?? "",
      dayLabelRu: DOW_RU[dow] ?? "",
      quantityPiece: Math.round(totalQty * 10) / 10,
      totalAmount: Math.round(totalAmt),
      isToday: i === 0,
    });
  }

  return bars;
}

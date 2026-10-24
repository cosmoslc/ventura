import { describe, expect, it } from "vitest";
import {
  calculateTerakProportionalBalance,
  calculateWorkerBalance,
} from "./balance";

describe("balance calculation module", () => {
  it("ishchi umumiy balansini to'g'ri hisoblaydi", () => {
    // 5 000 000 ishlar + 1 000 000 maosh accrual - 4 000 000 to'lov = 2 000 000 balans
    const res = calculateWorkerBalance({
      totalWorkEarned: 5000000,
      totalWageAccruals: 1000000,
      totalPayments: 4000000,
    });

    expect(res.totalEarned).toBe(6000000);
    expect(res.totalPaid).toBe(4000000);
    expect(res.balance).toBe(2000000);
  });

  it("ishchi ortiqcha olgan bo'lsa manfiy balans ko'rsatadi", () => {
    const res = calculateWorkerBalance({
      totalWorkEarned: 1000000,
      totalWageAccruals: 0,
      totalPayments: 1500000,
    });
    expect(res.balance).toBe(-500000);
  });

  it("ishchining terak bo'yicha mutanosib balansini to'g'ri taqsimlaydi", () => {
    // Ishchi jami 10 000 000 ishlagan, hozirgi balansi 2 000 000 (20%)
    // Bu terakda 3 000 000 ishlagan -> mutanosib balans 3 000 000 * 20% = 600 000
    const terakBal = calculateTerakProportionalBalance({
      workerTotalBalance: 2000000,
      workerTotalEarned: 10000000,
      workerEarnedInThisTerak: 3000000,
    });
    expect(terakBal).toBe(600000);
  });
});

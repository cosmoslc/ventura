/**
 * Ishchi balansi va teraklar bo'yicha mutanosib taqsimot moduli.
 * SAWMILL-TAHLIL 7-bo'limi asosida.
 */

export interface WorkerBalanceInput {
  totalWorkEarned: number;
  totalWageAccruals: number;
  totalPayments: number;
}

export interface WorkerBalanceResult {
  totalEarned: number;
  totalPaid: number;
  balance: number; // musbat: korxona qarzdor, manfiy: ishchi ortiqcha olgan
}

/**
 * Ishchining umumiy balansini hisoblaydi.
 * Balans = (Ishlar summasi + Hisoblangan maoshlar) - Berilgan to'lovlar
 */
export function calculateWorkerBalance(input: WorkerBalanceInput): WorkerBalanceResult {
  const totalEarned = Math.round(input.totalWorkEarned + input.totalWageAccruals);
  const totalPaid = Math.round(input.totalPayments);
  const balance = totalEarned - totalPaid;
  return {
    totalEarned,
    totalPaid,
    balance,
  };
}

export interface TerakProportionalBalanceInput {
  workerTotalBalance: number;
  workerTotalEarned: number;
  workerEarnedInThisTerak: number;
}

/**
 * Ishchining terak bo'yicha mutanosib balansini hisoblaydi.
 * To'lovlar umumiy bo'lgani sababli, terak balansi:
 * shuTerakdaIshlagan * (umumiyBalans / umumiyIshlagan)
 * (SAWMILL-TAHLIL 7-qism, 167-169-qatorlar)
 */
export function calculateTerakProportionalBalance(
  input: TerakProportionalBalanceInput,
): number {
  const { workerTotalBalance, workerTotalEarned, workerEarnedInThisTerak } = input;
  if (workerTotalEarned <= 0 || workerEarnedInThisTerak <= 0) return 0;
  const ratio = workerEarnedInThisTerak / workerTotalEarned;
  return Math.round(workerTotalBalance * ratio);
}

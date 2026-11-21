/*
 * Loyihaning oylik obunasi, 7 kunlik sinov muddati va to'lov hisobi yordamchisi.
 * Muallif / Agent: Google Gemini
 */

export interface ProjectSubscriptionData {
  active?: boolean;
  plan?: string;
  monthlyPrice?: number;
  paidUntil?: string;
  lastPaidAt?: string | null;
  lastPaymentAmount?: number;
  reminderSentFor?: string | null;
  autoFreeze?: boolean;
}

export interface ProjectTrialData {
  days?: number;
  active?: boolean;
  startedAt?: string;
  expiresAt?: string;
  activatedAt?: string;
}

export interface ProjectBillingSummary {
  kind: "trial" | "subscription" | "none";
  active: boolean;
  expiresAt: string | null; // paidUntil yoki trial.expiresAt
  daysLeft: number | null;
  expired: boolean;
  plan: string;
  monthlyPrice: number;
  isPaused: boolean;
}

export function parseProjectBilling(settings: unknown, status: string): ProjectBillingSummary {
  const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
  const sub = s.subscription as ProjectSubscriptionData | undefined;
  const trial = s.trial as ProjectTrialData | undefined;
  const isPaused = status === "paused";

  // 1. Agar subscription (oylik abonent to'lovi) sozlangan bo'lsa
  if (sub && sub.paidUntil) {
    const expDate = new Date(sub.paidUntil);
    const isValid = !isNaN(expDate.getTime());
    const now = Date.now();
    const expired = isValid && expDate.getTime() <= now;
    const daysLeft = isValid ? Math.ceil((expDate.getTime() - now) / (24 * 60 * 60 * 1000)) : null;

    return {
      kind: "subscription",
      active: Boolean(sub.active) && !expired && !isPaused,
      expiresAt: sub.paidUntil,
      daysLeft,
      expired,
      plan: sub.plan || "Standart",
      monthlyPrice: sub.monthlyPrice ?? 300_000,
      isPaused,
    };
  }

  // 2. Agar 7 kunlik trial faol bo'lsa
  if (trial && trial.active && trial.expiresAt) {
    const expDate = new Date(trial.expiresAt);
    const isValid = !isNaN(expDate.getTime());
    const now = Date.now();
    const expired = isValid && expDate.getTime() <= now;
    const daysLeft = isValid ? Math.ceil((expDate.getTime() - now) / (24 * 60 * 60 * 1000)) : null;

    return {
      kind: "trial",
      active: !expired && !isPaused,
      expiresAt: trial.expiresAt,
      daysLeft,
      expired,
      plan: "7 kunlik sinov",
      monthlyPrice: 0,
      isPaused,
    };
  }

  // 3. Cheksiz / doimiy faol
  return {
    kind: "none",
    active: status === "active",
    expiresAt: null,
    daysLeft: null,
    expired: false,
    plan: "Doimiy",
    monthlyPrice: 0,
    isPaused,
  };
}

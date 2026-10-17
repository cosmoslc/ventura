/** Ish haqi sahifasining toza yordamchilari (jadval katak qiymatlari) — hisob-kitob mantig'i lib/payroll.ts da */

export interface ProfileLinks {
  teacher: boolean;
  staff: boolean;
}

/** "teacher:<id>" / "user:<id>" → profil manzili; ruxsat yo'q yoki noto'g'ri qiymat — null. `month` o'qituvchi profilini shu oy bilan ochadi */
export function personHref(person: string, links: ProfileLinks, month?: string): string | null {
  const [kind, id] = person.split(":");
  if (!id) return null;
  if (kind === "teacher") return links.teacher ? `/teachers/${id}${month ? `?oy=${month}` : ""}` : null;
  if (kind === "user") return links.staff ? `/staff/${id}` : null;
  return null;
}

/** Qoldiq holati: qarz (berish kerak) / ortiqcha berilgan / yopilgan */
export function remainingState(remaining: number): "due" | "over" | "settled" {
  return remaining > 0 ? "due" : remaining < 0 ? "over" : "settled";
}

/** Belgi bilan: "+50 000", "−20 000"; nol — null */
export function signedAmount(n: number, format: (v: number) => string): string | null {
  return n === 0 ? null : `${n > 0 ? "+" : "−"}${format(Math.abs(n))}`;
}

interface BalanceLike {
  accrued: number;
  bonus: number;
  penalty: number;
  advance: number;
  paid: number;
  remaining: number;
}

/** Hisob-kitob jami qatori: ustunlar yig'indisi (bonus va jarima farqi bilan) */
export function sumBalances(balances: readonly BalanceLike[]) {
  const sum = (pick: (b: BalanceLike) => number) => balances.reduce((s, b) => s + pick(b), 0);
  return {
    accrued: sum((b) => b.accrued),
    adjust: sum((b) => b.bonus - b.penalty),
    advance: sum((b) => b.advance),
    paid: sum((b) => b.paid),
    remaining: sum((b) => b.remaining),
  };
}

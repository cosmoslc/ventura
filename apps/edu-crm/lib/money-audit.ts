/** Pul amallari tarixi guruhlari (ADR 0019) — server va client uchun umumiy */
export const MONEY_GROUPS = ["payment", "expense", "additional_income", "salary_entry", "approval"] as const;
export type MoneyGroup = (typeof MONEY_GROUPS)[number];

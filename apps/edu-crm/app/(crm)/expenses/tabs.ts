/** Xarajatlar sahifasi tablari (eski tizimdagidek; "Boshqa xodimlar" tabi u yerda ham bo'sh edi — olinmadi) */
export const EXPENSE_TABS = ["variable", "fixed", "categories", "plans"] as const;
export type ExpenseTab = (typeof EXPENSE_TABS)[number];

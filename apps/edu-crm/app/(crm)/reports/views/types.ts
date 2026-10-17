import type { ReportData } from "@/lib/reports";
import type { ReportPeriod } from "@/lib/server/reports";

/**
 * Hisobot ko'rinishi (ADR 0034): har hisobotning o'z sahifa tarkibi. Sarlavha, filtr qatori va Excel umumiy
 * (`[report]/page.tsx`); ko'rinish faqat tarkibni chizadi. Ma'lumot — yuklovchidan: umumiy `metrics/table/extra`
 * (Excel ham shundan) va hisobotga xos `view` (grafiklar uchun qo'shimcha ma'lumot, yuklovchi faylida turi bilan).
 */
export interface ReportViewProps {
  data: ReportData;
  period: ReportPeriod;
  today: string;
  /** Xodimda moliyaviy ruxsat bor */
  finance: boolean;
  /** Manzildagi hisobotga xos filtrlar (voronkada kurs, manba, xodim, bosqich, qidiruv) */
  query?: Record<string, string>;
  /** Ro'yxat sahifalariga havolalar (pul oqimi jadvali) */
  access?: ReportAccess;
}

/** Hisobot ko'rinishidagi havolalar uchun: xodim qaysi ro'yxat sahifalarini ocha oladi */
export interface ReportAccess {
  payments: boolean;
  income: boolean;
  expenses: boolean;
}

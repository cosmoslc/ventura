import "server-only";
import { type Permission, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import type { TenantDb } from "@ventura/db";
import { formatMonth } from "@/lib/format";
import { type ReportData, yearMonths } from "@/lib/reports";
import { uz } from "@/lib/uz";
import { leavesReport, retentionReport, riskReport } from "./academic-reports";
import { cashflow } from "./cashflow-reports";
import { courseRevenue, discountsReport, expenseAnalysis } from "./finance-reports";
import { funnelReport, lostReport, seasonalReport, sourcesReport } from "./lead-reports";
import { teachersReport } from "./teacher-reports";

/*
 * Hisobotlar ro'yxati va ma'lumoti (E5a, ADR 0030). Har hisobot: guruh, ruxsat, bo'lim, davr turi va yuklovchi.
 * Raqamlar ro'yxat sahifalaridagi bilan bir xil funksiyalardan: pul oqimi — bosh panel (loadFlows), to'lov va
 * chegirma — o'quvchi hisobi (loadAccounts), xarajat rejasi — ADR 0016 rejalari.
 */

const t = uz.reports;

/** year — faqat yil; period — yil + oy yoki barcha davr; month — yil + oy (barcha davrsiz); none — bugungi holat */
export type PeriodMode = "year" | "period" | "month" | "none";

/** Davr: yil (oy yo'q) yoki yil + oy; `months` null — barcha davr */
export interface ReportPeriod {
  year: number | null;
  month: number | null;
  months: string[] | null;
  /** [from, to) — sanalar; null — barcha davr */
  range: { from: string; to: string } | null;
  label: string;
}

export function reportPeriod(params: { yil?: string; oy?: string }, today: string, mode: PeriodMode): ReportPeriod {
  if (mode === "none") return { year: null, month: null, months: null, range: null, label: t.now };
  const cy = Number(today.slice(0, 4));
  const y =
    params.yil === "all" && mode === "period" ? null : /^\d{4}$/.test(params.yil ?? "") ? Number(params.yil) : cy;
  const m =
    mode === "year" || y === null
      ? null
      : params.oy === undefined
        ? Number(today.slice(5, 7))
        : /^(?:[1-9]|1[0-2])$/.test(params.oy)
          ? Number(params.oy)
          : null;
  if (y === null) return { year: null, month: null, months: null, range: null, label: t.allTime };
  if (m === null) {
    return {
      year: y,
      month: null,
      months: yearMonths(y),
      range: { from: `${y}-01-01`, to: `${y + 1}-01-01` },
      label: t.yearLabel(y),
    };
  }
  const key = `${y}-${String(m).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { year: y, month: m, months: [key], range: { from: `${key}-01`, to: `${next}-01` }, label: formatMonth(key) };
}

export interface LoadArgs {
  db: TenantDb;
  filter: readonly string[] | null;
  period: ReportPeriod;
  today: string;
  /** Xodimda moliyaviy ruxsat bor — pul ustunlari ko'rinadi (masalan manbalar tushumi) */
  finance?: boolean;
  /** Manzildagi hisobotga xos filtrlar (masalan voronkada kurs, manba, xodim, bosqich, qidiruv) */
  query?: Record<string, string | undefined>;
  /** Xodim hisobot sozlamasini o'zgartira oladi (voronkada bosqichlarni yashirish — `leads.edit`) */
  manage?: boolean;
}

export interface ReportDef {
  group: "finance" | "academic" | "leads" | "teachers";
  feature: string;
  permissions: readonly Permission[];
  periodMode: PeriodMode;
  load(args: LoadArgs): Promise<ReportData>;
}

const FINANCE: readonly Permission[] = ["dashboard.financial_stats"];
/** O'quv hisobotlari (E5 qarori 7) */
const ACADEMIC: readonly Permission[] = ["dashboard.view"];
/** Lid hisobotlari (E5 qarori 7) */
const LEADS: readonly Permission[] = ["dashboard.conversion_stats"];

/* ---------- Ro'yxat ---------- */

export const REPORTS = {
  cashflow: { group: "finance", feature: "payments", permissions: FINANCE, periodMode: "year", load: cashflow },
  expenses: {
    group: "finance",
    feature: "expenses",
    permissions: FINANCE,
    periodMode: "period",
    load: expenseAnalysis,
  },
  discounts: {
    group: "finance",
    feature: "payments",
    permissions: FINANCE,
    periodMode: "period",
    load: discountsReport,
  },
  courses: { group: "finance", feature: "payments", permissions: FINANCE, periodMode: "period", load: courseRevenue },
  leaves: { group: "academic", feature: "groups", permissions: ACADEMIC, periodMode: "period", load: leavesReport },
  risk: { group: "academic", feature: "attendance", permissions: ACADEMIC, periodMode: "none", load: riskReport },
  retention: {
    group: "academic",
    feature: "groups",
    permissions: ACADEMIC,
    periodMode: "period",
    load: retentionReport,
  },
  funnel: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: funnelReport },
  lost: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: lostReport },
  sources: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: sourcesReport },
  seasonal: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "year", load: seasonalReport },
  teachers: {
    group: "teachers",
    feature: "teachers",
    permissions: ACADEMIC,
    periodMode: "period",
    load: teachersReport,
  },
} as const satisfies Record<string, ReportDef>;

export type ReportKey = keyof typeof REPORTS;

/** Guruhlar tartibi (hisobotlar sahifasi va menyu) */
export const REPORT_GROUPS: readonly ReportDef["group"][] = ["finance", "academic", "leads", "teachers"];

/** Xodimga ochiq hisobotlar: ruxsati bor va bo'limi yoqilgan */
export async function visibleReports(
  tenant: Parameters<typeof hasFeature>[0],
  access: Parameters<typeof canAny>[0],
): Promise<ReportKey[]> {
  const keys: ReportKey[] = [];
  for (const [key, def] of Object.entries(REPORTS) as [ReportKey, ReportDef][])
    if (canAny(access, def.permissions) && (await hasFeature(tenant, def.feature))) keys.push(key);
  return keys;
}
export const isReportKey = (k: string): k is ReportKey => Object.hasOwn(REPORTS, k);

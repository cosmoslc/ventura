import type { ReportKey } from "@/lib/server/reports";
import { CashflowView } from "./cashflow";
import { PlanView } from "./plan";
import { ExpensesView } from "./expenses";
import { DiscountsView } from "./discounts";
import { CoursesView } from "./courses";
import { LeavesView } from "./leaves";
import { RiskView } from "./risk";
import { RetentionView } from "./retention";
import { FunnelView } from "./funnel";
import { LostView } from "./lost";
import { SourcesView } from "./sources";
import { SeasonalView } from "./seasonal";
import { TeachersView } from "./teachers";
import type { ReportViewProps } from "./types";

/** Hisobot → ko'rinish (ADR 0034). Har hisobot o'z faylida; bu ro'yxat o'zgarmaydi. */
export const REPORT_VIEWS: Record<ReportKey, (props: ReportViewProps) => React.ReactNode> = {
  cashflow: CashflowView,
  plan: PlanView,
  expenses: ExpensesView,
  discounts: DiscountsView,
  courses: CoursesView,
  leaves: LeavesView,
  risk: RiskView,
  retention: RetentionView,
  funnel: FunnelView,
  lost: LostView,
  sources: SourcesView,
  seasonal: SeasonalView,
  teachers: TeachersView,
};

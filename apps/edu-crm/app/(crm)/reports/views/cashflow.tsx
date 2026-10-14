import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** cashflow — hozircha umumiy ko'rinish */
export function CashflowView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

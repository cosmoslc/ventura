import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** funnel — hozircha umumiy ko'rinish */
export function FunnelView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

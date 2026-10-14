import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** risk — hozircha umumiy ko'rinish */
export function RiskView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

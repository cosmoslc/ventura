import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** plan — hozircha umumiy ko'rinish */
export function PlanView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

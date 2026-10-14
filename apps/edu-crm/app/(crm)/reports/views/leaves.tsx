import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** leaves — hozircha umumiy ko'rinish */
export function LeavesView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

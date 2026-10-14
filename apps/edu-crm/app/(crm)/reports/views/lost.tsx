import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** lost — hozircha umumiy ko'rinish */
export function LostView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

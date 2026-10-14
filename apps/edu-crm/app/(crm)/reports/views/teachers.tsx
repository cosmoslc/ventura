import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** teachers — hozircha umumiy ko'rinish */
export function TeachersView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

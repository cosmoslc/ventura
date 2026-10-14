import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** courses — hozircha umumiy ko'rinish */
export function CoursesView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

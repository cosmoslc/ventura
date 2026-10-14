import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** expenses — hozircha umumiy ko'rinish */
export function ExpensesView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** retention — hozircha umumiy ko'rinish */
export function RetentionView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

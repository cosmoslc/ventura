import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** sources — hozircha umumiy ko'rinish */
export function SourcesView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

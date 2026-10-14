import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** seasonal — hozircha umumiy ko'rinish */
export function SeasonalView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

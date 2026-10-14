import { DefaultReport } from "./default-report";
import type { ReportViewProps } from "./types";

/** discounts — hozircha umumiy ko'rinish */
export function DiscountsView({ data }: ReportViewProps) {
  return <DefaultReport data={data} />;
}

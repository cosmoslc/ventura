import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, Td, Th } from "@ventura/ui/table";
import { shortMonth } from "@/lib/cashflow-views";
import type { OperationalMonth } from "@/lib/operational";
import type { CellKind } from "@/lib/reports";
import { uz } from "@/lib/uz";
import { formatCell } from "../../report-table";
import { GridScroller } from "./grid-scroller";

const o = uz.reports.cashflow.operational;

const ROWS: { key: keyof Omit<OperationalMonth, "month" | "future">; label: string; kind: CellKind }[] = [
  { key: "leads", label: o.leads, kind: "number" },
  { key: "firstPayers", label: o.firstPayers, kind: "number" },
  { key: "conversion", label: o.conversion, kind: "percent" },
  { key: "students", label: o.students, kind: "number" },
  { key: "left", label: o.left, kind: "number" },
  { key: "groups", label: o.groups, kind: "number" },
  { key: "avgFill", label: o.avgFill, kind: "decimal" },
  { key: "attendance", label: o.attendance, kind: "percent" },
];

/** Operatsion ko'rsatkichlar (eski tizimdagi ikkinchi jadval): qator — ko'rsatkich, ustun — oy; faqat fakt */
export function OperationalGrid({ months, today }: { months: readonly OperationalMonth[]; today: string }) {
  const thisMonth = today.slice(0, 7);
  return (
    <GridScroller>
      <Table className="min-w-max">
        <THead>
          <tr>
            <Th data-sticky className="sticky left-0 z-(--z-raised) min-w-60 bg-card">
              {o.title}
            </Th>
            {months.map((m) => (
              <Th
                key={m.month}
                data-current={m.month === thisMonth ? "" : undefined}
                className={cn("text-right", m.month === thisMonth && "text-primary-text")}
                title={uz.months[Number(m.month.slice(5, 7)) - 1]}
              >
                {shortMonth(uz.months[Number(m.month.slice(5, 7)) - 1]!)}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {ROWS.map((r) => (
            <tr key={r.key} className="hover:bg-table-row-hover">
              <Td className="sticky left-0 z-(--z-raised) bg-card py-2.5 font-medium">{r.label}</Td>
              {months.map((m) => {
                const v = m[r.key];
                return (
                  <Td
                    key={m.month}
                    className={cn(
                      "px-3 py-2.5 text-right whitespace-nowrap tabular-nums",
                      v === null && "text-muted-foreground",
                    )}
                  >
                    {formatCell(v, r.kind)}
                  </Td>
                );
              })}
            </tr>
          ))}
        </TBody>
      </Table>
    </GridScroller>
  );
}

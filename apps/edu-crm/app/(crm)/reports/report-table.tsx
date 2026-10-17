import Link from "next/link";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { money } from "@/lib/format";
import type { Cell, CellKind, ReportTable } from "@/lib/reports";

/** Katak matni: pul va son — guruhlab, foiz — bir xona kasr bilan, bo'sh — "—" */
export function formatCell(value: Cell, kind: CellKind): string {
  if (value === null || value === "") return "—";
  if (typeof value === "string") return value;
  if (kind === "percent") return `${value.toFixed(1)}%`;
  if (kind === "decimal") return value.toFixed(1);
  if (kind === "money" || kind === "number") return `${value < 0 ? "−" : ""}${money(Math.abs(Math.round(value)))}`;
  return String(value);
}

/**
 * Hisobot jadvali (ADR 0030): birinchi ustun yopishqoq (keng jadvalda gorizontal aylantirishda ko'rinib turadi),
 * raqamlar o'ngda, manfiy pul qizil, bo'lim va jami qatorlari ajralib turadi.
 */
export function ReportTableView({ table, empty }: { table: ReportTable; empty: string }) {
  const [first, ...rest] = table.columns;
  if (!first) return null;
  const data = table.rows.filter((r) => r.kind !== "section" && r.kind !== "total");
  if (!data.length) return <p className="py-16 text-center text-body text-muted-foreground">{empty}</p>;
  const sticky = "sticky left-0 z-(--z-raised) bg-card";
  return (
    <TableWrap>
      <Table className={cn(table.columns.length > 8 && "min-w-[1100px]")}>
        <THead>
          <tr>
            <Th className={sticky}>{first.label}</Th>
            {rest.map((c) => (
              <Th key={c.key} className={c.kind === "text" ? undefined : "text-right"}>
                {c.label}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {table.rows.map((r, i) => {
            if (r.kind === "section") {
              return (
                <tr key={i} className="bg-muted/50">
                  <td
                    colSpan={table.columns.length}
                    className="px-4 py-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {r.cells[first.key]}
                  </td>
                </tr>
              );
            }
            const total = r.kind === "total";
            const label = formatCell(r.cells[first.key] ?? null, first.kind);
            return (
              <Tr key={i} className={cn(total && "border-t-2 border-border font-bold")}>
                <Td className={cn(sticky, "max-w-72 truncate font-semibold text-foreground")} title={label}>
                  {r.href ? (
                    <Link href={r.href} className="hover:text-primary-text">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </Td>
                {rest.map((c) => {
                  const v = r.cells[c.key] ?? null;
                  const text = formatCell(v, c.kind);
                  return (
                    <Td
                      key={c.key}
                      title={c.kind === "text" ? text : undefined}
                      className={cn(
                        c.kind === "text" ? "max-w-80 truncate" : "text-right whitespace-nowrap tabular-nums",
                        typeof v === "number" && v < 0 && c.kind === "money" && "text-(--danger-fg)",
                        v === null && "text-muted-foreground",
                      )}
                    >
                      {text}
                    </Td>
                  );
                })}
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}

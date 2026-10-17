import Link from "next/link";
import * as React from "react";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, Td, Th } from "@ventura/ui/table";
import { addDays, addMonths } from "@/lib/billing";
import {
  type GridKey,
  type GridRow,
  type PlanTone,
  planTone,
  shortMonth,
  showMonthForecast,
} from "@/lib/cashflow-views";
import { money } from "@/lib/format";
import type { PlanCell } from "@/lib/reports";
import { uz } from "@/lib/uz";
import { PlanCellButton } from "../../plan-editor";
import type { ReportAccess } from "../types";
import { GridScroller } from "./grid-scroller";

const t = uz.reports.cashflow;
const p = uz.reports.plan;

const signed = (n: number) => `${n < 0 ? "−" : ""}${money(Math.abs(Math.round(n)))}`;

const TONE: Record<PlanTone, string> = {
  success: "text-(--success-fg)",
  warning: "text-(--warning-fg)",
  danger: "text-(--danger-fg)",
};

const GROUP = "border-l border-border-soft";
const NUM = "px-3 py-2.5 text-right whitespace-nowrap tabular-nums";
const STICKY = "sticky left-0 z-(--z-raised) bg-card";

/** Fakt katagidan tegishli ro'yxat sahifasiga havola (oy bo'yicha); havola yo'q qatorlar — null */
function factHref(key: GridKey, month: string, access: ReportAccess | undefined): string | null {
  const range = `from=${month}-01&to=${addDays(`${addMonths(month, 1)}-01`, -1)}`;
  if (key === "payments" && access?.payments) return `/payments?month=${month}`;
  if (key === "income" && access?.income) return `/additional-income?${range}`;
  if (key === "expenses" && access?.expenses) return `/expenses?${range}`;
  return null;
}

function Value({ v, href }: { v: number | null; href?: string | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  const text = <span className={v < 0 ? "text-(--danger-fg)" : undefined}>{signed(v)}</span>;
  return href ? (
    <Link href={href} className="underline-offset-2 hover:text-primary-text hover:underline">
      {text}
    </Link>
  ) : (
    text
  );
}

/** Reja katagi: qatorga qarab — sahifadagi oyna orqali kiritiladi, xarajat rejasi — toifalar sahifasida */
function PlanCellView({
  row,
  month,
  cell,
  access,
}: {
  row: GridRow;
  month: string;
  cell: PlanCell;
  access?: ReportAccess;
}) {
  const body = <Value v={cell.plan} />;
  if (row.key === "payments" || row.key === "income" || row.key === "salary")
    return (
      <PlanCellButton month={month} line={row.key}>
        {body}
      </PlanCellButton>
    );
  if (row.key === "expenses" && access?.expenses)
    return (
      <Link
        href={`/expenses?tab=plans&month=${month}`}
        className="underline-offset-2 hover:text-primary-text hover:underline"
        title={p.expensesLink}
      >
        {body}
      </Link>
    );
  return body;
}

/**
 * Birlashgan jadval (eski tizimdagi Pul oqimi jadvali): qatorlar — to'lovlar, daromad, ish haqi, xarajat...;
 * har oy uchun uch ustun — reja, fakt, prognoz; oxirida yillik jami. Chap ustun qotirilgan. Reja katagi bosilsa reja
 * oynasi shu oy bilan ochiladi; fakt katagi — tegishli ro'yxatga havola. Prognoz faqat joriy va kelgusi oylarda.
 */
export function PlanGrid({
  rows,
  months,
  today,
  access,
}: {
  rows: readonly GridRow[];
  months: readonly string[];
  today: string;
  access?: ReportAccess;
}) {
  const thisMonth = today.slice(0, 7);
  const monthName = (m: string) => uz.months[Number(m.slice(5, 7)) - 1]!;
  const yearOver = months.every((m) => m < thisMonth);
  return (
    <GridScroller>
      <Table className="min-w-max">
        <THead>
          <tr>
            <Th rowSpan={2} data-sticky className={cn(STICKY, "min-w-52 align-bottom")}>
              {t.gridUnit}
            </Th>
            {months.map((m) => (
              <Th
                key={m}
                colSpan={3}
                data-current={m === thisMonth ? "" : undefined}
                className={cn(GROUP, "pb-1 text-center", m === thisMonth && "text-primary-text")}
                title={monthName(m)}
              >
                {shortMonth(monthName(m))}
              </Th>
            ))}
            <Th colSpan={3} className={cn(GROUP, "pb-1 text-center text-foreground")}>
              {uz.reports.total}
            </Th>
          </tr>
          <tr>
            {[...months, "total"].flatMap((m) =>
              [p.plan, p.fact, p.forecast].map((label, i) => (
                <Th
                  key={`${m}-${label}`}
                  className={cn(
                    "px-3 pt-0 pb-2 text-right text-2xs font-medium normal-case",
                    i === 0 && GROUP,
                    i === 2 && "text-primary-text",
                  )}
                >
                  {label}
                </Th>
              )),
            )}
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => {
            const bold = r.kind === "total";
            const balance = r.kind === "balance";
            return (
              <tr key={r.key} className={cn("hover:bg-table-row-hover", bold && "border-t-2 border-border font-bold")}>
                <Td
                  className={cn(
                    STICKY,
                    "py-2.5",
                    bold ? "text-foreground" : "font-medium",
                    balance && "text-muted-foreground",
                  )}
                >
                  {t.rows[r.key]}
                </Td>
                {months.map((m, i) => {
                  const cell = r.cells[i]!;
                  const past = m < thisMonth;
                  const tone = past ? planTone(cell.plan, cell.fact, r.lowerIsBetter) : null;
                  const forecast = !balance && showMonthForecast(m, today);
                  return (
                    <React.Fragment key={m}>
                      <Td className={cn(NUM, GROUP, "text-secondary-foreground")}>
                        {balance ? null : <PlanCellView row={r} month={m} cell={cell} access={access} />}
                      </Td>
                      <Td className={cn(NUM, tone && TONE[tone], bold ? "text-foreground" : undefined)}>
                        <Value v={cell.fact} href={factHref(r.key, m, access)} />
                      </Td>
                      <Td className={cn(NUM, "text-primary-text")}>
                        {forecast ? <Value v={Math.round(cell.forecast)} /> : null}
                      </Td>
                    </React.Fragment>
                  );
                })}
                <Td className={cn(NUM, GROUP, "text-secondary-foreground")}>
                  {balance ? null : <Value v={r.total.plan} />}
                </Td>
                <Td className={cn(NUM, "text-foreground")}>
                  <Value v={r.total.fact} />
                </Td>
                <Td className={cn(NUM, "text-primary-text")}>
                  {!balance && !yearOver ? <Value v={Math.round(r.total.forecast)} /> : null}
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </GridScroller>
  );
}

/** Jadval ostidagi rang izohi: fakt rangi rejaga nisbatan */
export function PlanGridLegend() {
  return (
    <p className="text-caption text-muted-foreground">
      <span className="text-(--success-fg)">{t.legendDone}</span> ·{" "}
      <span className="text-(--warning-fg)">{t.legendNear}</span> ·{" "}
      <span className="text-(--danger-fg)">{t.legendMissed}</span> ·{" "}
      <span className="text-primary-text">{p.forecast}</span>
      {" — "}
      {t.gridNote}
    </p>
  );
}

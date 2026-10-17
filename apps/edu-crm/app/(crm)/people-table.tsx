"use client";

import Link from "next/link";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";

/*
 * Xodim / o'qituvchi qatorli jadvallar uchun umumiy jadval (EDU-CRM-FIXES 5.3): "O'qituvchilar" sahifasi uslubi —
 * karta ichida, birinchi ustunda avatar + ism (havola) + qisqa izoh, raqamlar o'ngda (tabular), ixcham qator.
 * Sahifalar faqat ustunlar va (kerak bo'lsa) jami qatorini beradi; mobilda jadval karta ichida gorizontal siljiydi.
 */

export interface PersonCellData {
  name: string;
  /** null / berilmasa — havolasiz (ruxsat yo'q yoki profil yo'q) */
  href?: string | null;
  /** Ism ostidagi qisqa qator: lavozim, telefon */
  sub?: React.ReactNode;
}

/** Avatar + ism + qisqa qator; havola bo'lsa — butun katak bosiladi */
export function PersonCell({ name, href, sub }: PersonCellData) {
  const body = (
    <>
      <Avatar name={name} size={34} />
      <span className="min-w-0">
        <span className={cn("block truncate text-body font-bold text-foreground", href && "group-hover:text-primary")}>
          {name}
        </span>
        {sub ? <span className="block truncate text-caption text-muted-foreground">{sub}</span> : null}
      </span>
    </>
  );
  if (!href) return <div className="flex items-center gap-2.5">{body}</div>;
  return (
    <Link href={href} className="group flex items-center gap-2.5 max-[900px]:min-h-10">
      {body}
    </Link>
  );
}

export interface PeopleColumn<R> {
  key: string;
  header: React.ReactNode;
  cell: (row: R) => React.ReactNode;
  /** O'ngga tekislash (pul, sonlar, amallar) */
  align?: "right" | "center";
  className?: string;
  headClassName?: string;
}

/** Jadval ostidagi jami qatori: birinchi katakda yorliq, ustun kaliti bo'yicha qiymatlar */
export interface PeopleTotal {
  label: React.ReactNode;
  cells: Readonly<Record<string, React.ReactNode>>;
}

const ALIGN = { right: "text-right", center: "text-center" } as const;
/** Pul va sonlar ustuni: o'ngda, raqamlar bir xil kenglikda */
export const NUM = "whitespace-nowrap tabular-nums";

export function PeopleTable<R>({
  rows,
  rowKey,
  person,
  personHeader,
  columns,
  total,
  minWidth = 900,
  header,
  footer,
  empty,
  rowClassName,
  className,
}: {
  rows: readonly R[];
  rowKey: (row: R) => string;
  person: (row: R) => PersonCellData;
  personHeader: React.ReactNode;
  columns: readonly PeopleColumn<R>[];
  total?: PeopleTotal;
  /** Jadvalning eng kichik kengligi (px): undan tor ekranda gorizontal siljiydi */
  minWidth?: number;
  /** Jadval ustidagi qism — kartaning ichida */
  header?: React.ReactNode;
  /** Jadval ostidagi qism (sahifalash) */
  footer?: React.ReactNode;
  /** Qator bo'lmaganda jadval o'rniga */
  empty: React.ReactNode;
  rowClassName?: (row: R) => string | undefined;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {header}
      {rows.length ? (
        <>
          <TableWrap>
            <Table style={{ minWidth }}>
              <THead>
                <tr>
                  <Th>{personHeader}</Th>
                  {columns.map((c) => (
                    <Th key={c.key} className={cn(c.align && ALIGN[c.align], c.headClassName)}>
                      {c.header}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={rowKey(r)} className={rowClassName?.(r)}>
                    <Td>
                      <PersonCell {...person(r)} />
                    </Td>
                    {columns.map((c) => (
                      <Td key={c.key} className={cn(c.align && ALIGN[c.align], c.className)}>
                        {c.cell(r)}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
              {total ? (
                <tfoot className="border-t border-border bg-(--table-foot)">
                  <tr>
                    <Td className="text-body font-bold text-foreground">{total.label}</Td>
                    {columns.map((c) => (
                      <Td key={c.key} className={cn("font-bold text-foreground", c.align && ALIGN[c.align])}>
                        {total.cells[c.key] ?? null}
                      </Td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </Table>
          </TableWrap>
          {footer}
        </>
      ) : (
        empty
      )}
    </Card>
  );
}

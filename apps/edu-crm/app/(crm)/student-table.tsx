"use client";

import Link from "next/link";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Card } from "@ventura/ui/card";
import { Checkbox } from "@ventura/ui/checkbox";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";

/*
 * O'quvchilar ro'yxati uchun yagona jadval (EDU-CRM-FIXES 4.2): "O'quvchilar" sahifasidagi uslub — avatar + ism
 * (havola) + qisqa izoh birinchi ustunda, qolgan ustunlar sozlama bilan. Sahifalar faqat ustunlarni beradi:
 * qator balandligi, ranglar, hover, tanlov katagi, bo'sh holat va mobil ko'rinish (gorizontal siljish) shu yerda.
 */

export interface StudentCellData {
  name: string;
  /** null — havolasiz (masalan, arxivdagi o'quvchi) */
  href?: string | null;
  /** Ism ostidagi qisqa qator: telefon, "profilni ko'rish" yoki boshqa */
  sub?: React.ReactNode;
}

/** Avatar + ism + qisqa qator; ism havola bo'lsa — butun katak bosiladi */
export function StudentCell({ name, href, sub }: StudentCellData) {
  const body = (
    <>
      <Avatar name={name} size={34} />
      <span className="min-w-0">
        <span className={cn("block truncate text-body font-bold text-foreground", href && "group-hover:text-primary")}>
          {name}
        </span>
        {sub ? <span className="block text-caption text-muted-foreground">{sub}</span> : null}
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

export interface StudentColumn<R> {
  key: string;
  header: React.ReactNode;
  cell: (row: R, index: number) => React.ReactNode;
  /** O'ngga tekislash (raqamlar, amallar) */
  align?: "right" | "center";
  /** Katak (Td) uchun qo'shimcha klass */
  className?: string;
  /** Sarlavha (Th) uchun qo'shimcha klass */
  headClassName?: string;
}

export interface StudentSelection {
  selected: ReadonlySet<string>;
  onToggle: (id: string, on: boolean) => void;
  /** Ko'rinib turgan sahifadagi hammasini belgilash/olish */
  onTogglePage: (on: boolean) => void;
  pageLabel: string;
  rowLabel: (name: string) => string;
}

const ALIGN = { right: "text-right", center: "text-center" } as const;

export function StudentsTable<R>({
  rows,
  rowKey,
  student,
  studentHeader,
  columns,
  selection,
  minWidth = 860,
  header,
  footer,
  empty,
  rowClassName,
  className,
}: {
  rows: readonly R[];
  rowKey: (row: R) => string;
  student: (row: R) => StudentCellData;
  studentHeader: React.ReactNode;
  columns: readonly StudentColumn<R>[];
  selection?: StudentSelection;
  /** Jadvalning eng kichik kengligi (px): undan tor ekranda gorizontal siljiydi */
  minWidth?: number;
  /** Jadval ustidagi qism (sarlavha, tablar, filtr) — kartaning ichida */
  header?: React.ReactNode;
  /** Jadval ostidagi qism (sahifalash, "yana ko'rsatish") */
  footer?: React.ReactNode;
  /** Qator bo'lmaganda jadval o'rniga ko'rsatiladi */
  empty: React.ReactNode;
  rowClassName?: (row: R) => string | undefined;
  className?: string;
}) {
  const pageSelected = selection ? rows.filter((r) => selection.selected.has(rowKey(r))).length : 0;
  const headerState: boolean | "indeterminate" =
    pageSelected === 0 ? false : pageSelected === rows.length ? true : "indeterminate";

  return (
    <Card className={cn("overflow-hidden", className)}>
      {header}
      {rows.length ? (
        <>
          <TableWrap>
            <Table style={{ minWidth }}>
              <THead>
                <tr>
                  {selection ? (
                    <Th className="w-10 pr-0">
                      <Checkbox
                        aria-label={selection.pageLabel}
                        checked={headerState}
                        onCheckedChange={(v) => selection.onTogglePage(v === true)}
                      />
                    </Th>
                  ) : null}
                  <Th>{studentHeader}</Th>
                  {columns.map((c) => (
                    <Th key={c.key} className={cn(c.align && ALIGN[c.align], c.headClassName)}>
                      {c.header}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {rows.map((r, i) => {
                  const id = rowKey(r);
                  const s = student(r);
                  const picked = !!selection?.selected.has(id);
                  return (
                    <Tr key={id} className={cn(picked && "bg-primary-soft", rowClassName?.(r))}>
                      {selection ? (
                        <Td className="w-10 pr-0">
                          <Checkbox
                            aria-label={selection.rowLabel(s.name)}
                            checked={picked}
                            onCheckedChange={(v) => selection.onToggle(id, v === true)}
                          />
                        </Td>
                      ) : null}
                      <Td>
                        <StudentCell {...s} />
                      </Td>
                      {columns.map((c) => (
                        <Td key={c.key} className={cn(c.align && ALIGN[c.align], c.className)}>
                          {c.cell(r, i)}
                        </Td>
                      ))}
                    </Tr>
                  );
                })}
              </TBody>
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

/** Guruh (yoki boshqa) bo'yicha ajratilgan qutining sarlavhasi: nom (ixtiyoriy havola), qisqa izoh, o'ngda jami */
export function GroupBoxHeader({
  title,
  href,
  sub,
  aside,
}: {
  title: React.ReactNode;
  href?: string;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border-soft px-5 py-3.5">
      <div className="min-w-0">
        <div className="truncate text-body font-bold text-foreground">
          {href ? (
            <Link href={href} className="hover:text-primary">
              {title}
            </Link>
          ) : (
            title
          )}
        </div>
        {sub ? <div className="text-caption text-muted-foreground">{sub}</div> : null}
      </div>
      {aside ? <div className="text-right text-body font-bold whitespace-nowrap text-foreground">{aside}</div> : null}
    </div>
  );
}

/** Jadval ostidagi "Yana N ta" tugmasi (qisman ko'rsatilgan ro'yxatlar uchun) */
export function MoreRows({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer border-t border-border-soft py-3 text-center text-caption font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

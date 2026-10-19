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
  numbered = false,
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
  /** O'quvchidan oldin tartib raqami (№) ustuni */
  numbered?: boolean;
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
                  {numbered ? <Th className="w-12">№</Th> : null}
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
                      {numbered ? <Td className="w-12 font-mono text-muted-foreground">{i + 1}</Td> : null}
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

/** Guruh "qutichasi" (o'quvchilar jadvalidagi kabi): nom, ixtiyoriy izoh (o'qituvchi), guruh sahifasiga havola */
export function GroupChip({
  id,
  name,
  sub,
  muted,
  href,
}: {
  id: string;
  name: string;
  sub?: string | null;
  muted?: boolean;
  /** Boshqa manzil (o'qituvchi kabinetida — `/kabinet/guruhlar/<id>`) */
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/groups/${id}`}
      className={cn(
        "inline-block max-w-full truncate rounded-badge border border-border-soft bg-muted px-2 py-0.5 text-caption hover:border-(--ring-border)",
        muted && "opacity-60",
      )}
    >
      <span className="font-semibold text-foreground">{name}</span>
      {sub ? <span className="text-muted-foreground"> · {sub}</span> : null}
    </Link>
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

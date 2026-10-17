"use client";

import { Pencil, RotateCcw, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import type { ShareRow, TeacherPayrollRow } from "@/lib/server/payroll";
import { formatDate, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { VoidRecordDialog } from "../expenses/void-dialog";
import { restoreSalaryEntryAction, voidSalaryEntryAction } from "../salaries/actions";
import type { SalaryEntryRow } from "../salaries/data";
import type { SalaryPerms } from "../salaries/salary-form";

const t = uz.salaries;
const KIND_TONE = { salary: "success", advance: "info", bonus: "warning", penalty: "danger" } as const;
const som = (n: number) => `${money(n)} ${uz.common.som}`;

/**
 * O'qituvchi profilidagi "Tranzaksiyalar" tabi (ADR 0021): tanlangan oydagi maosh, avans, bonus va jarima yozuvlari —
 * Ish haqi sahifasidagi bilan bir xil amallar (tahrirlash, bekor qilish, tiklash) va ruxsatlar.
 */
export function TeacherTransactions({
  entries,
  perms,
  onEdit,
}: {
  entries: SalaryEntryRow[];
  perms: SalaryPerms;
  onEdit: (e: SalaryEntryRow) => void;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = React.useState<SalaryEntryRow | null>(null);
  const [, startTransition] = React.useTransition();
  const can = (k: SalaryEntryRow["kind"]) =>
    k === "salary" ? perms.salary : k === "advance" ? perms.advance : perms.adjust;

  function restore(e: SalaryEntryRow) {
    startTransition(async () => {
      const res = await restoreSalaryEntryAction(e.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.restoredOk });
      router.refresh();
    });
  }

  if (!entries.length) return <EmptyState icon={<Wallet />} title={t.noEntries} />;

  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <Tr>
              <Th className="w-10">#</Th>
              <Th className="text-right">{t.colAmount}</Th>
              <Th>{t.colDate}</Th>
              <Th>{t.colKind}</Th>
              <Th>{t.colNote}</Th>
              <Th>{t.colCreatedBy}</Th>
              <Th className="text-right">{uz.common.actions}</Th>
            </Tr>
          </THead>
          <TBody>
            {entries.map((e, i) => (
              <Tr key={e.id} className={cn(e.voided && "opacity-60")}>
                <Td className="text-muted-foreground">{i + 1}</Td>
                <Td
                  className={cn(
                    "text-right font-semibold whitespace-nowrap",
                    e.kind === "penalty" ? "text-(--danger-fg)" : "text-(--success-fg)",
                    e.voided && "line-through",
                  )}
                >
                  {e.kind === "penalty" ? "−" : ""}
                  {som(e.amount)}
                </Td>
                <Td className="whitespace-nowrap">{formatDate(e.date)}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={KIND_TONE[e.kind]}>{t.kinds[e.kind]}</Badge>
                    {e.methodName ? <span className="text-caption text-muted-foreground">{e.methodName}</span> : null}
                  </div>
                  {e.voided ? (
                    <div className="mt-1 text-caption text-(--danger-fg)">
                      {t.voided}: {e.voided.reason}
                    </div>
                  ) : null}
                </Td>
                <Td className="max-w-56 truncate text-caption text-muted-foreground" title={e.note ?? undefined}>
                  {e.note ?? "—"}
                </Td>
                <Td className="text-caption text-muted-foreground">{e.createdByName ?? "—"}</Td>
                <Td>
                  {can(e.kind) ? (
                    <div className="flex justify-end gap-1">
                      {e.voided ? (
                        <Button
                          variant="icon"
                          size="icon"
                          aria-label={t.restore}
                          title={t.restore}
                          onClick={() => restore(e)}
                        >
                          <RotateCcw />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="icon"
                            size="icon"
                            aria-label={uz.common.edit}
                            title={uz.common.edit}
                            onClick={() => onEdit(e)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon"
                            className="text-destructive-text"
                            aria-label={t.void}
                            title={t.void}
                            onClick={() => setVoiding(e)}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <VoidRecordDialog
        target={voiding ? { id: voiding.id, summary: `${t.kinds[voiding.kind]} · ${som(voiding.amount)}` } : null}
        title={t.voidTitle}
        successTitle={t.voidedOk}
        onClose={() => setVoiding(null)}
        onVoid={voidSalaryEntryAction}
      />
    </>
  );
}

/**
 * "To'lovlardan hisoblangan ulush" tabi (eski tizimdagidek): tanlangan oyda guruhlariga tushgan har to'lov, ulush sharti
 * va ustozga hisoblangan summa; belgilangan oyliklar alohida qatorda (ish boshlagan sanasi bilan). Ish haqi
 * hisobining o'zi bilan bir manba: qatorlar yig'indisi "hisoblangan"ga teng (ADR 0043).
 */
export function TeacherShares({
  row,
  groupNames,
  shares,
}: {
  row: TeacherPayrollRow;
  groupNames: Record<string, string>;
  shares: ShareRow[];
}) {
  const tt = uz.teachers;
  if (!shares.length) return <EmptyState icon={<Wallet />} title={tt.sharesEmpty} />;

  const condition = (r: ShareRow) => {
    if (r.salaryType === "percent") return `${r.value}%`;
    if (r.salaryType === "per_student") return tt.perStudentCondition(money(r.value));
    const parts: string[] = [tt.fixedCondition];
    if (r.from) parts.push(tt.fromDay(formatDate(r.from)));
    if (r.proration) parts.push(tt.proratedDays(r.proration.days, r.proration.total));
    return parts.join(" · ");
  };
  const who = (r: ShareRow) =>
    r.kind === "own"
      ? tt.ownSalaryRow
      : r.kind === "group"
        ? tt.groupFixedRow(groupNames[r.groupId ?? ""] ?? "—")
        : (r.studentName ?? "—");

  return (
    <div className="space-y-3">
      <div className="text-body font-bold text-foreground">{tt.sharesTitle}</div>
      <TableWrap>
        <Table>
          <THead>
            <Tr>
              <Th className="w-10">#</Th>
              <Th>{tt.colPayer}</Th>
              <Th>{t.colGroup}</Th>
              <Th className="text-right">{tt.colPaid}</Th>
              <Th>{tt.colCondition}</Th>
              <Th className="text-right">{tt.colAccrued}</Th>
              <Th>{tt.colDate}</Th>
            </Tr>
          </THead>
          <TBody>
            {shares.map((r, i) => (
              <Tr key={r.key}>
                <Td className="text-muted-foreground">{i + 1}</Td>
                <Td className="font-medium text-foreground">
                  {r.kind === "payment" && r.studentId ? (
                    <Link href={`/students/${r.studentId}`} className="hover:text-primary">
                      {who(r)}
                    </Link>
                  ) : (
                    who(r)
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {r.kind === "payment" ? (groupNames[r.groupId ?? ""] ?? "—") : "—"}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {r.amount === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={cn(r.amount < 0 && "text-(--danger-fg)")}>
                      {r.amount < 0 ? "−" : ""}
                      {som(Math.abs(r.amount))}
                    </span>
                  )}
                </Td>
                <Td className="text-muted-foreground">{condition(r)}</Td>
                <Td className="text-right font-semibold whitespace-nowrap">
                  {r.pay === 0 && r.salaryType === "fixed" && r.kind === "payment" ? (
                    <span className="font-normal text-muted-foreground">—</span>
                  ) : (
                    <span className={cn(r.pay < 0 ? "text-(--danger-fg)" : "text-(--success-fg)")}>
                      {r.pay < 0 ? "−" : "+"}
                      {som(Math.abs(r.pay))}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{r.date ? formatDate(r.date) : "—"}</Td>
              </Tr>
            ))}
            <Tr className="bg-muted">
              <Td className="font-bold text-foreground" colSpan={3}>
                {tt.sharesTotal}
              </Td>
              <Td className="text-right font-semibold whitespace-nowrap">{som(row.accrual.revenue)}</Td>
              <Td />
              <Td className="text-right font-bold whitespace-nowrap">{som(row.accrual.total)}</Td>
              <Td />
            </Tr>
          </TBody>
        </Table>
      </TableWrap>
    </div>
  );
}

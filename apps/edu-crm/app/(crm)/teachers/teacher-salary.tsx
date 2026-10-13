"use client";

import { Pencil, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import type { TeacherPayrollRow } from "@/lib/server/payroll";
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

/** "To'lovlardan hisoblangan ulush" tabi: guruhlar bo'yicha tushum va o'qituvchi ulushi (Ish haqi bilan bir manba) */
export function TeacherShares({ row, groupNames }: { row: TeacherPayrollRow; groupNames: Record<string, string> }) {
  const a = row.accrual;
  const groups = a.groups.filter((g) => g.pay !== 0 || g.revenue !== 0);
  if (!groups.length && !a.base) return <EmptyState icon={<Wallet />} title={t.noGroupPay} />;
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr>
            <Th>{t.colGroup}</Th>
            <Th>{t.colType}</Th>
            <Th className="text-right">{t.colRevenue}</Th>
            <Th className="text-right">{t.colShare}</Th>
          </Tr>
        </THead>
        <TBody>
          {a.base ? (
            <Tr>
              <Td className="font-medium text-foreground">{t.ownSalary}</Td>
              <Td className="text-muted-foreground">{t.typeName.fixed}</Td>
              <Td className="text-right text-muted-foreground">—</Td>
              <Td className="text-right font-semibold">{money(a.base)}</Td>
            </Tr>
          ) : null}
          {groups.map((g) => (
            <Tr key={g.groupId}>
              <Td className="font-medium text-foreground">{groupNames[g.groupId] ?? "—"}</Td>
              <Td className="text-muted-foreground">{t.typeName[g.salaryType]}</Td>
              <Td className="text-right whitespace-nowrap">{money(g.revenue)}</Td>
              <Td className="text-right font-semibold whitespace-nowrap">{money(g.pay)}</Td>
            </Tr>
          ))}
          <Tr className="bg-muted">
            <Td className="font-bold text-foreground" colSpan={2}>
              {uz.teachers.sharesTotal}
            </Td>
            <Td className="text-right font-semibold whitespace-nowrap">{money(a.revenue)}</Td>
            <Td className="text-right font-bold whitespace-nowrap">{money(a.total)}</Td>
          </Tr>
        </TBody>
      </Table>
    </TableWrap>
  );
}

"use client";

import { Banknote, Coins, Plus, Scale, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import type { Payroll, TeacherPayrollRow } from "@/lib/server/payroll";
import { formatDate, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { MethodOption } from "../payments/payment-dialog";
import type { SalaryEntryRow } from "../salaries/data";
import { SalaryForm, type SalaryFormState, type SalaryPerms } from "../salaries/salary-form";

const t = uz.salaries;
const KIND_TONE = { salary: "success", advance: "info", bonus: "warning", penalty: "danger" } as const;
const som = (n: number) => `${money(n)} ${uz.common.som}`;

/**
 * O'qituvchi profilidagi "Maosh" bo'limi (ADR 0018): tanlangan oy uchun hisoblangan, bonus/jarima, berilgan va
 * qoldiq — Ish haqi sahifasidagi bilan bir xil manba (lib/server/payroll.ts), guruhlar bo'yicha ulush va yozuvlar.
 */
export function TeacherSalary({
  teacherName,
  month,
  months,
  row,
  groupNames,
  entries,
  methods,
  perms,
}: {
  teacherName: string;
  month: string;
  months: string[];
  row: TeacherPayrollRow;
  groupNames: Record<string, string>;
  entries: SalaryEntryRow[];
  methods: MethodOption[];
  perms: SalaryPerms;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = React.useState<SalaryFormState | null>(null);
  const b = row.balance;
  const a = row.accrual;
  const adj = b.bonus - b.penalty;
  const person = `teacher:${row.id}`;
  const canWrite = perms.salary || perms.advance || perms.adjust;
  const payroll: Payroll = { month, rows: [row], totals: { revenue: a.revenue, share: a.total, center: 0 } };
  const groups = a.groups.filter((g) => g.pay !== 0 || g.revenue !== 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-heading text-title text-foreground">{t.profileTitle}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label={t.month}
            value={month}
            onValueChange={(m) => router.push(`${pathname}?oy=${m}`, { scroll: false })}
            className="sm:w-44"
            options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
          />
          {canWrite ? (
            <Button
              onClick={() => setForm({ editing: null, person, month, amount: b.remaining > 0 ? b.remaining : null })}
            >
              <Plus /> {t.add}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone={2}
          icon={<Coins />}
          label={t.colAccrued}
          value={som(b.accrued)}
          hint={t.accruedHint(som(a.revenue))}
        />
        <StatCard
          tone={4}
          icon={<Scale />}
          label={t.colBonus}
          value={`${adj > 0 ? "+" : adj < 0 ? "−" : ""}${som(Math.abs(adj))}`}
          hint={t.adjustHint}
        />
        <StatCard
          tone={1}
          icon={<Banknote />}
          label={t.colPaid}
          value={som(b.paid)}
          hint={t.paidHint(som(b.advance))}
        />
        <StatCard
          tone={3}
          icon={<Wallet />}
          label={t.colRemaining}
          value={`${b.remaining < 0 ? "−" : ""}${som(Math.abs(b.remaining))}`}
          hint={b.remaining < 0 ? t.overpaid : t.remainingHint}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h3 className="border-b border-border-soft px-4 py-3 text-body font-bold text-foreground">{t.groupsTitle}</h3>
          {groups.length || a.base ? (
            <TableWrap className="rounded-none border-0">
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
                </TBody>
              </Table>
            </TableWrap>
          ) : (
            <p className="px-4 py-6 text-center text-caption text-muted-foreground">{t.noGroupPay}</p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <h3 className="border-b border-border-soft px-4 py-3 text-body font-bold text-foreground">
            {t.entriesTitle}
          </h3>
          {entries.length ? (
            <ul className="divide-y divide-border-soft">
              {entries.map((e) => (
                <li key={e.id} className={cn("flex items-center gap-3 px-4 py-2.5", e.voided && "opacity-60")}>
                  <Badge tone={KIND_TONE[e.kind]}>{t.kinds[e.kind]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
                    {formatDate(e.date)}
                    {e.methodName ? ` · ${e.methodName}` : ""}
                    {e.voided ? ` · ${t.voided}` : e.note ? ` · ${e.note}` : ""}
                  </span>
                  <span
                    className={cn(
                      "font-semibold whitespace-nowrap",
                      e.kind === "penalty" ? "text-(--danger-fg)" : "text-foreground",
                      e.voided && "line-through",
                    )}
                  >
                    {e.kind === "penalty" ? "−" : ""}
                    {money(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-caption text-muted-foreground">{t.noEntries}</p>
          )}
        </Card>
      </div>

      {canWrite ? (
        <SalaryForm
          state={form}
          onClose={() => setForm(null)}
          people={[{ value: person, name: teacherName, kind: "teacher" }]}
          methods={methods}
          months={months}
          perms={perms}
          payroll={payroll}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}

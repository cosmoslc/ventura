"use client";

import { Banknote, HandCoins, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@ventura/ui/card";
import { FilterSelect } from "@ventura/ui/filter-bar";
import { MetricCard } from "@ventura/ui/metric-card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { formatMonth, money } from "@/lib/format";
import type { KabinetFinance } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { TeacherShares, TeacherTransactions } from "../../../(crm)/teachers/teacher-salary";

const t = uz.kabinet;
const NO_PERMS = { salary: false, advance: false, adjust: false };

function condition(g: KabinetFinance["groups"][number]) {
  if (g.salaryType === "percent") return g.value === null ? "—" : `${g.value}%`;
  if (g.salaryType === "per_student") return uz.teachers.perStudentCondition(money(g.value ?? 0));
  return uz.teachers.fixedCondition;
}

export function FinanceView({ data, month, months }: { data: KabinetFinance | null; month: string; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const header = (
    <PageHeader
      title={t.financeTitle}
      description={t.financeDescription}
      actions={
        <FilterSelect
          label={t.month}
          value={month}
          onValueChange={(m) => router.push(`${pathname}?oy=${m}`, { scroll: false })}
          className="sm:w-44"
          options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
        />
      }
    />
  );
  if (!data)
    return (
      <div className="space-y-section">
        {header}
        <Card>
          <EmptyState icon={<Wallet />} title={t.salariesOff} />
        </Card>
      </div>
    );

  const b = data.row.balance;
  const revenue = data.groups.reduce((s, g) => s + g.revenue, 0);
  const share = data.groups.reduce((s, g) => s + g.pay, 0);

  return (
    <div className="space-y-section">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label={t.balance}
          value={`${b.remaining > 0 ? "+" : b.remaining < 0 ? "−" : ""}${money(Math.abs(b.remaining))}`}
          unit={uz.common.som}
          badge={b.remaining > 0 ? t.balanceRemaining : b.remaining < 0 ? t.balanceDebt : t.balanceEven}
          tone={b.remaining > 0 ? "success" : b.remaining < 0 ? "danger" : "neutral"}
          colorValue
          highlight={b.remaining !== 0}
        />
        <MetricCard
          label={t.accrued}
          value={money(b.accrued)}
          unit={uz.common.som}
          icon={<Banknote />}
          tone="primary"
          foot={t.accruedFoot}
        />
        <MetricCard
          label={t.bonus}
          value={money(b.bonus)}
          unit={uz.common.som}
          tone={b.bonus ? "success" : "neutral"}
          colorValue={b.bonus > 0}
        />
        <MetricCard
          label={t.penalty}
          value={money(b.penalty)}
          unit={uz.common.som}
          tone={b.penalty ? "danger" : "neutral"}
          colorValue={b.penalty > 0}
        />
        <MetricCard
          label={t.paidOut}
          value={money(b.paid)}
          unit={uz.common.som}
          icon={<HandCoins />}
          tone="info"
          foot={t.paidOutFoot(`${money(b.advance)} ${uz.common.som}`)}
        />
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="type-heading text-base">{t.groupsRevenueTitle}</h2>
        {data.groups.length ? (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>{t.colGroup}</Th>
                  <Th className="text-right">{t.colRevenue}</Th>
                  <Th>{t.colCondition}</Th>
                  <Th className="text-right">{t.colShare}</Th>
                </tr>
              </THead>
              <TBody>
                {data.groups.map((g) => (
                  <Tr key={g.groupId}>
                    <Td className="font-semibold text-foreground">{g.name}</Td>
                    <Td className="text-right font-mono tabular-nums">{money(g.revenue)}</Td>
                    <Td className="text-(--success-fg)">{condition(g)}</Td>
                    <Td className="text-right font-mono font-semibold tabular-nums">{money(g.pay)}</Td>
                  </Tr>
                ))}
                <Tr className="bg-muted font-bold">
                  <Td>{t.total}</Td>
                  <Td className="text-right font-mono tabular-nums">{money(revenue)}</Td>
                  <Td />
                  <Td className="text-right font-mono tabular-nums">{money(share)}</Td>
                </Tr>
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Wallet />} title={t.groupsEmpty} />
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="type-heading text-base">{t.entriesTitle}</h2>
        <TeacherTransactions entries={data.entries} perms={NO_PERMS} onEdit={() => {}} />
      </Card>

      <Card className="p-5">
        <TeacherShares row={data.row} groupNames={data.groupNames} shares={data.shares} />
      </Card>
    </div>
  );
}

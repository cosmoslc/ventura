"use client";

import { AlarmClock, CircleDollarSign, Search, UserX, Users, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { displayPhone, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { type MethodOption, PaymentDialog } from "../payments/payment-dialog";
import type { DebtorRow } from "./data";

const t = uz.debtors;
const ALL = "all";
const SORTS = ["high", "low", "oldest", "name"] as const;

export function DebtorsView({
  rows,
  dueDay,
  methods,
  canPay,
  maxDiscountPercent,
}: {
  rows: DebtorRow[];
  dueDay: number;
  methods: MethodOption[];
  canPay: boolean;
  maxDiscountPercent: number;
}) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [teacher, setTeacher] = React.useState(ALL);
  const [sort, setSort] = React.useState<(typeof SORTS)[number]>("high");
  const [paying, setPaying] = React.useState<string | null>(null);

  const groupOptions = [...new Map(rows.flatMap((r) => r.groups.map((g) => [g.id, g.name] as const))).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  const teacherOptions = [
    ...new Map(
      rows.flatMap((r) => r.groups.flatMap((g) => (g.teacherId ? [[g.teacherId, g.teacherName ?? ""] as const] : []))),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows
    .filter((r) => {
      if (group !== ALL && !r.groups.some((g) => g.id === group)) return false;
      if (teacher !== ALL && !r.groups.some((g) => g.teacherId === teacher)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.parentName ?? "").toLowerCase().includes(q) ||
        r.groups.some((g) => g.name.toLowerCase().includes(q)) ||
        (!!digits && (r.phone.includes(digits) || (r.parentPhone ?? "").includes(digits)))
      );
    })
    .sort((a, b) => {
      if (sort === "low") return a.debt - b.debt;
      if (sort === "oldest")
        return (a.oldestUnpaid ?? "9999").localeCompare(b.oldestUnpaid ?? "9999") || b.debt - a.debt;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.debt - a.debt;
    });

  const total = rows.reduce((s, r) => s + r.debt, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} tone={4} label={t.kpiCount} value={String(rows.length)} hint={t.kpiCountHint} />
        <StatCard
          icon={<CircleDollarSign />}
          tone={3}
          label={t.kpiSum}
          value={`${money(total)} ${uz.common.som}`}
          hint={t.kpiSumHint}
        />
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.kpiPartial}
          value={String(rows.filter((r) => r.partial).length)}
          hint={t.kpiPartialHint}
        />
        <StatCard
          icon={<AlarmClock />}
          tone={3}
          label={t.kpiOverdue}
          value={String(rows.filter((r) => r.overdueDays > 0).length)}
          hint={t.kpiOverdueHint(dueDay)}
        />
      </div>

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="debt-search">{uz.common.search}</Label>
          <Input
            id="debt-search"
            icon={<Search />}
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label>{t.group}</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-full" aria-label={t.group}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allGroups}</SelectItem>
              {groupOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.teacher}</Label>
          <Select value={teacher} onValueChange={setTeacher}>
            <SelectTrigger className="w-full" aria-label={t.teacher}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allTeachers}</SelectItem>
              {teacherOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.sort}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as (typeof SORTS)[number])}>
            <SelectTrigger className="w-full" aria-label={t.sort}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t.sorts[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3 text-caption text-muted-foreground">
          {t.count(visible.length, rows.length)}
        </div>
        {visible.length ? (
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <Tr>
                  <Th>{t.colStudent}</Th>
                  <Th>{t.colGroups}</Th>
                  <Th>{t.colMonths}</Th>
                  <Th className="text-right">{t.colDebt}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th className="text-right">{uz.common.actions}</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.studentId}>
                    <Td>
                      <Link
                        href={`/students/${r.studentId}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {r.name}
                      </Link>
                      {r.archived ? (
                        <Badge tone="neutral" className="ml-2">
                          {t.archived}
                        </Badge>
                      ) : null}
                      <div className="text-caption text-muted-foreground">
                        {displayPhone(r.phone)}
                        {r.parentPhone ? ` · ${r.parentName ?? ""} ${displayPhone(r.parentPhone)}` : ""}
                      </div>
                    </Td>
                    <Td>
                      {r.groups.map((g) => (
                        <div key={g.id} className="text-body">
                          {g.name}
                          <span className="text-caption text-muted-foreground">
                            {g.teacherName ? ` · ${g.teacherName}` : ""} · {money(g.due)}
                          </span>
                        </div>
                      ))}
                      {r.otherDebt > 0 ? (
                        <div className="text-caption text-muted-foreground">
                          {t.otherDebt}: {money(r.otherDebt)}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(r.groups.flatMap((g) => g.months))].sort().map((m) => (
                          <Badge key={m} tone="danger">
                            {formatMonth(m)}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-right font-semibold whitespace-nowrap text-(--danger-fg)">
                      {money(r.debt)} {uz.common.som}
                    </Td>
                    <Td>
                      {r.overdueDays > 0 ? (
                        <Badge tone="danger">{t.overdue(r.overdueDays)}</Badge>
                      ) : (
                        <Badge tone="warning">{t.dueSoon}</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      {canPay ? (
                        <Button size="sm" onClick={() => setPaying(r.studentId)}>
                          {t.pay}
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<UserX />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      <PaymentDialog
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
        studentId={paying ?? undefined}
        studentName={rows.find((r) => r.studentId === paying)?.name}
        methods={methods}
        maxDiscountPercent={maxDiscountPercent}
      />
    </div>
  );
}

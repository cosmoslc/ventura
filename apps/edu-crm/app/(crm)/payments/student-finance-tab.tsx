"use client";

import { Pencil, Percent, Plus, Printer, RotateCcw, Scale, Trash2, Undo2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatDate, formatMonth, money, signedMoney } from "@/lib/format";
import type { LedgerSummary } from "@/lib/ledger";
import { uz } from "@/lib/uz";
import { deleteDiscountAction, restoreEntryAction } from "./actions";
import type { DiscountRow, PaymentRow, StudentGroupOption } from "./data";
import { CorrectionDialog, DiscountDialog, EditEntryDialog, RefundDialog, VoidDialog } from "./finance-dialogs";
import { BalanceText, type MethodOption, PaymentDialog } from "./payment-dialog";
import type { FinancePerms } from "./perms";

const t = uz.finance;
const p = uz.payments;
const STATUS_TONE = { paid: "success", partial: "warning", unpaid: "danger", free: "neutral" } as const;
const KIND_TONE = { payment: "success", refund: "danger", discount: "info", correction: "neutral" } as const;

/** Yozuvning hisobga ta'siri (ishorali) */
const effect = (e: PaymentRow) => (e.kind === "refund" ? -e.amount : e.amount);

export function StudentFinanceTab({
  studentId,
  summary,
  groups,
  entries,
  discounts,
  methods,
  perms,
  maxDiscountPercent,
}: {
  studentId: string;
  summary: LedgerSummary;
  groups: StudentGroupOption[];
  entries: PaymentRow[];
  discounts: DiscountRow[];
  methods: MethodOption[];
  perms: FinancePerms;
  maxDiscountPercent: number;
}) {
  const router = useRouter();
  const [payFor, setPayFor] = React.useState<string | null | undefined>(undefined);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [correctOpen, setCorrectOpen] = React.useState(false);
  const [discountFor, setDiscountFor] = React.useState<DiscountRow | null | undefined>(undefined);
  const [discountDelete, setDiscountDelete] = React.useState<DiscountRow | null>(null);
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [editing, setEditing] = React.useState<PaymentRow | null>(null);
  const [, startTransition] = React.useTransition();
  const nameOf = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? "—") : p.noGroup);

  function restore(e: PaymentRow) {
    startTransition(async () => {
      const res = await restoreEntryAction(e.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: p.restoredOk });
      router.refresh();
    });
  }

  async function removeDiscount(d: DiscountRow) {
    const res = await deleteDiscountAction(d.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: t.discountDeleted });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Wallet />}
          tone={summary.balance < 0 ? 4 : 2}
          label={summary.balance < 0 ? t.debt : summary.balance > 0 ? t.credit : t.balance}
          value={`${money(Math.abs(summary.balance))} ${uz.common.som}`}
          hint={t.balanceHint}
        />
        <StatCard icon={<Scale />} tone={1} label={t.charged} value={`${money(summary.charged)} ${uz.common.som}`} />
        <StatCard icon={<Plus />} tone={3} label={t.paid} value={`${money(summary.credited)} ${uz.common.som}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {perms.create ? (
          <Button onClick={() => setPayFor(null)}>
            <Wallet /> {t.pay}
          </Button>
        ) : null}
        {perms.create && summary.balance > 0 ? (
          <Button variant="ghost" onClick={() => setRefundOpen(true)}>
            <Undo2 /> {p.refund}
          </Button>
        ) : null}
        {perms.discount ? (
          <Button variant="ghost" onClick={() => setDiscountFor(null)}>
            <Percent /> {t.discountAdd}
          </Button>
        ) : null}
        {perms.correct ? (
          <Button variant="ghost" onClick={() => setCorrectOpen(true)}>
            <Scale /> {p.correction}
          </Button>
        ) : null}
      </div>

      {summary.otherDebt > 0 ? (
        <Notice tone="warning">{t.otherDebt(`${money(summary.otherDebt)} ${uz.common.som}`)}</Notice>
      ) : null}

      <section className="space-y-3">
        <h3 className="type-heading text-base">{t.groupsTitle}</h3>
        {summary.groups.some((g) => g.months.length) ? (
          summary.groups
            .filter((g) => g.months.length)
            .map((g) => (
              <div key={g.groupId} className="space-y-2 rounded-card border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{nameOf(g.groupId)}</div>
                    <div className="text-caption text-muted-foreground">
                      {t.groupLine(`${money(g.charged)} ${uz.common.som}`, `${money(g.credited)} ${uz.common.som}`)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BalanceText value={g.balance} />
                    {perms.create && g.months.some((m) => m.due > 0) ? (
                      <Button size="sm" onClick={() => setPayFor(g.groupId)}>
                        {t.pay}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <TableWrap>
                  <Table>
                    <THead>
                      <Tr>
                        <Th>{t.monthCol}</Th>
                        <Th className="text-center">{t.lessonsCol}</Th>
                        <Th className="text-right">{t.priceCol}</Th>
                        <Th className="text-right">{t.chargeCol}</Th>
                        <Th className="text-right">{t.coveredCol}</Th>
                        <Th className="text-right">{t.dueCol}</Th>
                        <Th>{t.statusCol}</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {[...g.months].reverse().map((m) => (
                        <Tr key={`${m.membershipId}|${m.month}`}>
                          <Td className="font-medium whitespace-nowrap">{formatMonth(m.month)}</Td>
                          <Td className="text-center">
                            {t.lessonsOf(m.charged, m.lessons)}
                            {m.excused ? (
                              <div className="text-caption text-muted-foreground">{t.excusedNote(m.excused)}</div>
                            ) : null}
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            {money(m.fullPrice)}
                            {m.fullPrice !== m.basePrice ? (
                              <div className="text-caption text-muted-foreground">
                                {t.discountNote(money(m.basePrice))}
                              </div>
                            ) : null}
                          </Td>
                          <Td className="text-right font-medium whitespace-nowrap">{money(m.amount)}</Td>
                          <Td className="text-right whitespace-nowrap">{money(m.covered)}</Td>
                          <Td
                            className={cn(
                              "text-right font-semibold whitespace-nowrap",
                              m.due > 0 && "text-(--danger-fg)",
                            )}
                          >
                            {money(m.due)}
                          </Td>
                          <Td>
                            <Badge tone={STATUS_TONE[m.status]}>{t.statuses[m.status]}</Badge>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              </div>
            ))
        ) : (
          <Notice tone="info">{t.noCharges}</Notice>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="type-heading text-base">{t.discountsTitle}</h3>
        {discounts.length ? (
          <ul className="space-y-2">
            {discounts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">
                    {d.kind === "percent" ? `${d.value}%` : `${money(d.value)} ${uz.common.som}`} ·{" "}
                    {d.groupName ?? t.discountAllGroups}
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {t.discountPeriod(formatMonth(d.fromMonth), d.toMonth ? formatMonth(d.toMonth) : null)} · {d.reason}
                    {!d.affectsTeacher ? ` · ${t.discountTeacherNo}` : ""}
                  </div>
                </div>
                {perms.discount ? (
                  <div className="flex gap-1">
                    <Button variant="icon" size="icon" aria-label={uz.common.edit} onClick={() => setDiscountFor(d)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={uz.common.delete}
                      onClick={() => setDiscountDelete(d)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">{t.discountsEmpty}</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="type-heading text-base">{t.entriesTitle}</h3>
        {entries.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>{p.colDate}</Th>
                  <Th>{p.kind}</Th>
                  <Th>{p.colGroup}</Th>
                  <Th>{p.colMethod}</Th>
                  <Th className="text-right">{p.colAmount}</Th>
                  <Th>{p.colStaff}</Th>
                  <Th className="text-right">{uz.common.actions}</Th>
                </Tr>
              </THead>
              <TBody>
                {entries.map((e) => (
                  <Tr key={e.id} className={cn(e.voided && "opacity-60")}>
                    <Td className="whitespace-nowrap">
                      {formatDate(e.date)}
                      {e.receiptNo ? (
                        <div className="text-caption text-muted-foreground">{p.receiptNo(e.receiptNo)}</div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={KIND_TONE[e.kind]}>{p.kinds[e.kind]}</Badge>
                      {e.voided ? (
                        <div className="mt-1 text-caption text-(--danger-fg)">
                          {p.voided}: {e.voided.reason}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      {nameOf(e.groupId)}
                      {e.month ? (
                        <div className="text-caption text-muted-foreground">{formatMonth(e.month)}</div>
                      ) : null}
                      {e.note ? <div className="text-caption text-muted-foreground">{e.note}</div> : null}
                    </Td>
                    <Td>{e.methodName ?? "—"}</Td>
                    <Td
                      className={cn(
                        "text-right font-semibold whitespace-nowrap",
                        effect(e) < 0 ? "text-(--danger-fg)" : "text-(--success-fg)",
                        e.voided && "line-through",
                      )}
                    >
                      {signedMoney(effect(e))}
                    </Td>
                    <Td className="text-caption text-muted-foreground">{e.createdByName ?? "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {e.kind === "payment" && perms.receipt && !e.voided ? (
                          <Button variant="icon" size="icon" aria-label={p.receipt} asChild>
                            <a href={`/payments/${e.id}/receipt`} target="_blank" rel="noreferrer">
                              <Printer />
                            </a>
                          </Button>
                        ) : null}
                        {!e.voided && e.kind !== "correction" && perms.edit ? (
                          <Button variant="icon" size="icon" aria-label={uz.common.edit} onClick={() => setEditing(e)}>
                            <Pencil />
                          </Button>
                        ) : null}
                        {!e.voided && (e.kind === "correction" ? perms.correct : perms.void) ? (
                          <Button variant="icon" size="icon" aria-label={p.void} onClick={() => setVoiding(e)}>
                            <Trash2 />
                          </Button>
                        ) : null}
                        {e.voided && perms.restore ? (
                          <Button variant="icon" size="icon" aria-label={p.restore} onClick={() => restore(e)}>
                            <RotateCcw />
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Wallet />} title={t.entriesEmpty} />
        )}
      </section>

      <PaymentDialog
        open={payFor !== undefined}
        onOpenChange={(o) => !o && setPayFor(undefined)}
        studentId={studentId}
        groupId={payFor ?? undefined}
        methods={methods}
        maxDiscountPercent={maxDiscountPercent}
      />
      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        studentId={studentId}
        available={Math.max(0, summary.balance)}
        groups={groups}
        methods={methods}
      />
      <CorrectionDialog
        open={correctOpen}
        onOpenChange={setCorrectOpen}
        studentId={studentId}
        balance={summary.balance}
      />
      <DiscountDialog
        open={discountFor !== undefined}
        onOpenChange={(o) => !o && setDiscountFor(undefined)}
        studentId={studentId}
        groups={groups}
        editing={discountFor ?? null}
      />
      <VoidDialog entry={voiding} onClose={() => setVoiding(null)} />
      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} groups={groups} methods={methods} />
      <ConfirmModal
        open={!!discountDelete}
        onOpenChange={(o) => !o && setDiscountDelete(null)}
        title={uz.common.confirmTitle}
        message={t.discountDeleteText}
        confirmLabel={uz.common.confirmDelete}
        onConfirm={() => discountDelete && removeDiscount(discountDelete)}
      />
    </div>
  );
}

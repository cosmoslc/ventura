"use client";

import { Coins, Pencil, Printer, RotateCcw, Scale, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatDate, formatMonth, money, signedMoney } from "@/lib/format";
import { type LedgerSummary, pastDebt } from "@/lib/ledger";
import { uz } from "@/lib/uz";
import { restoreEntryAction } from "./actions";
import type { PaymentRow, StudentGroupOption } from "./data";
import { EditEntryDialog, VoidDialog } from "./finance-dialogs";
import { BalanceText, type MethodOption } from "./payment-dialog";
import type { FinancePerms } from "./perms";

const t = uz.finance;
const p = uz.payments;
const STATUS_TONE = { paid: "success", partial: "warning", unpaid: "danger", free: "neutral" } as const;
const KIND_TONE = {
  payment: "success",
  refund: "danger",
  discount: "info",
  correction: "neutral",
  writeoff: "neutral",
} as const;

/** Yozuvning hisobga ta'siri (ishorali) */
const effect = (e: PaymentRow) => (e.kind === "refund" ? -e.amount : e.amount);

/**
 * Profil tablari ustidagi doimiy kartalar: balans, o'tgan oydan qarz va coin (faqat `coins` bo'limi yoqilganda,
 * ADR 0061). Moliya ko'rinmasa ham coin kartasi o'zi chiqadi.
 */
export function StudentMoneyCards({
  summary,
  currentMonth,
  coins,
}: {
  summary: LedgerSummary | null;
  currentMonth: string;
  /** null — coin bo'limi o'chiq */
  coins: number | null;
}) {
  const cols = (summary ? 2 : 0) + (coins === null ? 0 : 1);
  if (!cols) return null;
  return (
    <div className={cols === 3 ? "grid gap-3 sm:grid-cols-3" : cols === 2 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
      {summary ? <MoneyCards summary={summary} currentMonth={currentMonth} /> : null}
      {coins !== null ? (
        <StatCard icon={<Coins />} tone={1} label={uz.coins.cardTitle} value={money(coins)} hint={uz.coins.cardHint} />
      ) : null}
    </div>
  );
}

function MoneyCards({ summary, currentMonth }: { summary: LedgerSummary; currentMonth: string }) {
  const past = pastDebt(summary, currentMonth);
  const shown = past.months.slice(0, 2).map(formatMonth).join(", ");
  return (
    <>
      <StatCard
        icon={<Wallet />}
        tone={summary.balance < 0 ? 3 : 2}
        label={uz.students.cardBalance}
        value={`${signedMoney(summary.balance)} ${uz.common.som}`}
        hint={summary.balance < 0 ? t.debt : summary.balance > 0 ? t.credit : t.balanceHint}
      />
      <StatCard
        icon={<Scale />}
        tone={past.amount > 0 ? 3 : 2}
        label={uz.students.cardPastDebt}
        value={past.amount > 0 ? `${money(past.amount)} ${uz.common.som}` : uz.students.pastDebtNone}
        hint={
          past.amount > 0
            ? `${shown}${past.months.length > 2 ? ` +${past.months.length - 2}` : ""}`
            : uz.students.pastDebtHint
        }
      />
    </>
  );
}

/**
 * "To'lovlar" tabi: guruhlar bo'yicha oylik hisob va yozuvlar. To'lov, qaytarish, balansni tuzatish va filialga
 * o'tkazish — profildagi uch nuqta menyusida; chegirmalar — o'z tabida (ADR 0020).
 */
export function StudentFinanceTab({
  summary,
  groups,
  entries,
  methods,
  perms,
  onPay,
}: {
  summary: LedgerSummary;
  groups: StudentGroupOption[];
  entries: PaymentRow[];
  methods: MethodOption[];
  perms: FinancePerms;
  /** Guruh bo'yicha to'lov oynasini ochish (oyna profilda) */
  onPay: (groupId: string) => void;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [editing, setEditing] = React.useState<PaymentRow | null>(null);
  const [, startTransition] = React.useTransition();
  const nameOf = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? "—") : p.noGroup);

  function restore(e: PaymentRow) {
    startTransition(async () => {
      const res = await restoreEntryAction(e.id);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: p.restoredOk });
      router.refresh();
    });
  }

  return (
    <div className="space-y-section">
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
                      <Button size="sm" onClick={() => onPay(g.groupId)}>
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
                        {!e.voided && e.kind !== "correction" && e.kind !== "writeoff" && perms.edit ? (
                          <Button variant="icon" size="icon" aria-label={uz.common.edit} onClick={() => setEditing(e)}>
                            <Pencil />
                          </Button>
                        ) : null}
                        {!e.voided &&
                        (e.kind === "correction" || e.kind === "writeoff" ? perms.correct : perms.void) ? (
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

      <VoidDialog entry={voiding} onClose={() => setVoiding(null)} />
      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} groups={groups} methods={methods} />
    </div>
  );
}

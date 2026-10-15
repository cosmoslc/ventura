"use client";

import { Check, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { toast } from "@ventura/ui/toast";
import type { OpeningBalances } from "@/lib/opening-balance";
import { uz } from "@/lib/uz";
import { saveOpeningBalanceAction } from "./actions";

const t = uz.reports.cashflow.opening;

interface Row {
  amount: number | null;
  date: string;
}

/**
 * Boshlang'ich qoldiq (E6j, ADR 0038): har filial uchun kassadagi qoldiq va sana. Bo'sh summa — qoldiq yo'q.
 * Xodim faqat o'zi ko'radigan filiallarni o'zgartiradi (server ham tekshiradi).
 */
export function OpeningBalanceEditor({
  branches,
  openings,
  today,
}: {
  branches: { id: string; name: string }[];
  openings: OpeningBalances;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, Row>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function start() {
    setRows(
      Object.fromEntries(
        branches.map((b) => [b.id, { amount: openings[b.id]?.amount ?? null, date: openings[b.id]?.date ?? "" }]),
      ),
    );
    setError(null);
    setOpen(true);
  }

  const patch = (id: string, p: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id]!, ...p } }));
    setError(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (branches.some((b) => rows[b.id]?.amount !== null && !rows[b.id]?.date)) return setError(t.dateRequired);
    startTransition(async () => {
      const res = await saveOpeningBalanceAction({
        entries: branches.map((b) => ({
          branchId: b.id,
          amount: rows[b.id]?.amount ?? null,
          date: rows[b.id]?.date ?? "",
        })),
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: res.changed ? "success" : "info", title: res.changed ? t.saved : t.unchanged });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={start}>
        <Wallet /> {t.button}
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title={t.title}
        description={t.hint}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="opening-balance-form" disabled={pending}>
              <Check /> {uz.common.save}
            </Button>
          </>
        }
      >
        <form id="opening-balance-form" onSubmit={submit} className="space-y-4">
          {branches.map((b) => (
            <div key={b.id} className="space-y-2">
              {branches.length > 1 ? <p className="text-body font-semibold text-foreground">{b.name}</p> : null}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <div>
                  <Label htmlFor={`ob-amount-${b.id}`}>{t.amount}</Label>
                  <MoneyInput
                    id={`ob-amount-${b.id}`}
                    value={rows[b.id]?.amount ?? null}
                    onValueChange={(v) => patch(b.id, { amount: v })}
                    suffix={uz.common.som}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor={`ob-date-${b.id}`}>{t.date}</Label>
                  <Input
                    id={`ob-date-${b.id}`}
                    type="date"
                    max={today}
                    value={rows[b.id]?.date ?? ""}
                    onChange={(e) => patch(b.id, { date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
          {error ? <FieldHint error>{error}</FieldHint> : null}
        </form>
      </Modal>
    </>
  );
}

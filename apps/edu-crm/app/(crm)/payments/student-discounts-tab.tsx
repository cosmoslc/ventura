"use client";

import { Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import { formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { deleteDiscountAction } from "./actions";
import type { DiscountRow, StudentGroupOption } from "./data";
import { DiscountDialog } from "./finance-dialogs";
import type { FinancePerms } from "./perms";

const t = uz.finance;

/** O'quvchi profilidagi "Chegirmalar" tabi: doimiy chegirmalar ro'yxati, qo'shish, tahrirlash va o'chirish */
export function StudentDiscountsTab({
  studentId,
  discounts,
  groups,
  perms,
}: {
  studentId: string;
  discounts: DiscountRow[];
  groups: StudentGroupOption[];
  perms: FinancePerms;
}) {
  const router = useRouter();
  const [discountFor, setDiscountFor] = React.useState<DiscountRow | null | undefined>(undefined);
  const [discountDelete, setDiscountDelete] = React.useState<DiscountRow | null>(null);

  async function remove(d: DiscountRow) {
    const res = await deleteDiscountAction(d.id);
    if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
    toast({ tone: "success", title: t.discountDeleted });
    router.refresh();
  }

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-body font-bold text-foreground">{t.discountsTitle}</div>
        {perms.discount ? (
          <Button size="sm" onClick={() => setDiscountFor(null)}>
            <Plus /> {t.discountAdd}
          </Button>
        ) : null}
      </div>

      {discounts.length ? (
        <ul className="space-y-2">
          {discounts.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border-soft px-4 py-3"
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
                  <Button variant="icon" size="icon" aria-label={uz.common.delete} onClick={() => setDiscountDelete(d)}>
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Percent />} title={t.discountsEmpty} />
      )}

      <DiscountDialog
        open={discountFor !== undefined}
        onOpenChange={(o) => !o && setDiscountFor(undefined)}
        studentId={studentId}
        groups={groups}
        editing={discountFor ?? null}
      />
      <ConfirmModal
        open={!!discountDelete}
        onOpenChange={(o) => !o && setDiscountDelete(null)}
        title={uz.common.confirmTitle}
        message={t.discountDeleteText}
        confirmLabel={uz.common.confirmDelete}
        onConfirm={() => discountDelete && remove(discountDelete)}
      />
    </div>
  );
}

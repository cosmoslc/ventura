"use client";

import { Package } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { RelayPackage, RelayWallet } from "@ventura/integrations/relay";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { toast } from "@ventura/ui/toast";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { buySmsPackageAction } from "./actions";

const t = uz.sms;

/**
 * Ventura SMS paketlari (ADR 0056): markaz paketni tanlaydi — panelda to'lov so'rovi paydo bo'ladi, Ventura to'lovni
 * tasdiqlagach SMS qismlari hisobga tushadi. Kutilayotgan so'rovlar ustida ko'rinadi.
 */
export function SmsPackages({ wallet, canBuy }: { wallet: RelayWallet; canBuy: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<RelayPackage | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function buy(pkg: RelayPackage) {
    startTransition(async () => {
      const res = await buySmsPackageAction(pkg.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.buyRequested, description: t.buyRequestedHint });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="type-heading text-base">{t.packagesTitle}</h2>
      {wallet.pending.map((p) => (
        <Notice key={p.id} tone="info">
          {t.pendingRequest(p.packageName, money(p.price))}
        </Notice>
      ))}
      {wallet.packages.length ? (
        <div className="grid gap-grid sm:grid-cols-2 xl:grid-cols-4">
          {wallet.packages.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="text-body font-bold text-foreground">{p.name}</div>
              <div className="mt-2 type-stat leading-tight font-bold text-foreground">{t.smsCount(p.parts)}</div>
              <div className="mt-1 text-body text-muted-foreground">
                {money(p.price)} {uz.common.som} · {t.perSms(money(Math.round(p.price / p.parts)))}
              </div>
              {canBuy ? (
                <Button
                  className="mt-4"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setPicked(p);
                    setOpen(true);
                  }}
                >
                  <Package /> {t.buy}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">{t.noPackages}</p>
      )}
      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title={t.buyTitle}
        message={picked ? t.buyText(picked.name, t.smsCount(picked.parts), money(picked.price)) : ""}
        confirmLabel={t.buy}
        onConfirm={() => picked && buy(picked)}
      />
    </div>
  );
}

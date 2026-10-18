"use client";

import { Check, Clock, MessageSquareText, Pencil, Plus, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { formatMoney } from "@ventura/ui/lib/money";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatDateTime } from "@/lib/format";
import { uz } from "@/lib/uz";
import {
  type SmsResult,
  adjustSmsWalletAction,
  connectSmsEskizAction,
  decideSmsPurchaseAction,
  saveSmsPackageAction,
} from "./actions";

const t = uz.sms;
const som = (n: number) => `${formatMoney(n)} so'm`;
const sms = (n: number) => `${formatMoney(n)} SMS`;

interface PackageRow {
  id: string;
  name: string;
  parts: number;
  price: number;
  active: boolean;
}

interface PendingRow {
  id: string;
  project: string;
  packageName: string;
  parts: number;
  price: number;
  requestedBy: string | null;
  createdAt: string;
}

interface WalletRow {
  id: string;
  name: string;
  slug: string;
  balance: number;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-heading text-base">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (action: () => Promise<SmsResult>, done: string, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: done });
      after?.();
      router.refresh();
    });
  return { run, pending };
}

/** Ventura SMS paketi boshqaruvi (ADR 0056). */
export function SmsAdminView({
  canEdit,
  eskiz,
  packages,
  pending,
  wallets,
}: {
  canEdit: boolean;
  eskiz: {
    email: string | null;
    sender: string | null;
    connected: boolean;
    balance: number | null;
    error: string | null;
  };
  packages: PackageRow[];
  pending: PendingRow[];
  wallets: WalletRow[];
}) {
  const { run, pending: busy } = useRun();
  const [decide, setDecide] = React.useState<{ row: PendingRow; paid: boolean } | null>(null);
  const [pkg, setPkg] = React.useState<PackageRow | "new" | null>(null);
  const [adjust, setAdjust] = React.useState<WalletRow | null>(null);
  const total = wallets.reduce((s, w) => s + w.balance, 0);

  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} />
      {eskiz.error ? <Notice tone="danger">{t.eskizError(eskiz.error)}</Notice> : null}
      {!eskiz.connected ? <Notice tone="warning">{t.notConnected}</Notice> : null}

      <div className="grid gap-grid sm:grid-cols-3">
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.eskizBalance}
          value={eskiz.balance == null ? "—" : som(eskiz.balance)}
        />
        <StatCard icon={<Clock />} tone={3} label={t.pendingCount} value={String(pending.length)} />
        <StatCard icon={<MessageSquareText />} tone={2} label={t.walletsTotal} value={sms(total)} />
      </div>

      <Section title={t.pendingTitle}>
        {pending.length ? (
          <TableWrap>
            <Table className="min-w-[760px]">
              <THead>
                <Tr>
                  <Th>{t.colProject}</Th>
                  <Th>{t.colPackage}</Th>
                  <Th className="text-right">{t.colPrice}</Th>
                  <Th>{t.colRequested}</Th>
                  {canEdit ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {pending.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-foreground">{p.project}</Td>
                    <Td>
                      {p.packageName}
                      <div className="text-caption text-muted-foreground">{sms(p.parts)}</div>
                    </Td>
                    <Td className="text-right whitespace-nowrap">{som(p.price)}</Td>
                    <Td>
                      {p.requestedBy ?? "—"}
                      <div className="text-caption text-muted-foreground">{formatDateTime(p.createdAt)}</div>
                    </Td>
                    {canEdit ? (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" disabled={busy} onClick={() => setDecide({ row: p, paid: true })}>
                            <Check /> {t.markPaid}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setDecide({ row: p, paid: false })}
                          >
                            <X /> {t.cancel}
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <p className="text-body text-muted-foreground">{t.noPending}</p>
        )}
      </Section>

      <Section title={t.walletsTitle}>
        <TableWrap>
          <Table className="min-w-[560px]">
            <THead>
              <Tr>
                <Th>{t.colProject}</Th>
                <Th className="text-right">{t.colBalance}</Th>
                {canEdit ? <Th className="text-right">{uz.common.actions}</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {wallets.map((w) => (
                <Tr key={w.id}>
                  <Td>
                    <span className="font-semibold text-foreground">{w.name}</span>
                    <div className="text-caption text-muted-foreground">{w.slug}</div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">{sms(w.balance)}</Td>
                  {canEdit ? (
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setAdjust(w)}>
                        {t.adjust}
                      </Button>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Section>

      <Section
        title={t.packagesTitle}
        action={
          canEdit ? (
            <Button variant="ghost" onClick={() => setPkg("new")}>
              <Plus /> {t.packageAdd}
            </Button>
          ) : null
        }
      >
        {packages.length ? (
          <TableWrap>
            <Table className="min-w-[560px]">
              <THead>
                <Tr>
                  <Th>{t.colName}</Th>
                  <Th className="text-right">{t.colParts}</Th>
                  <Th className="text-right">{t.colPrice}</Th>
                  <Th>{t.colStatus}</Th>
                  {canEdit ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {packages.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-foreground">{p.name}</Td>
                    <Td className="text-right">{sms(p.parts)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {som(p.price)}
                      <div className="text-caption text-muted-foreground">
                        {t.perSms(formatMoney(Math.round(p.price / p.parts)))}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={p.active ? "success" : "neutral"} dot>
                        {p.active ? t.active : t.inactive}
                      </Badge>
                    </Td>
                    {canEdit ? (
                      <Td className="text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={uz.common.edit}
                          aria-label={uz.common.edit}
                          onClick={() => setPkg(p)}
                        >
                          <Pencil />
                        </Button>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <p className="text-body text-muted-foreground">{t.noPackages}</p>
        )}
      </Section>

      <EskizCard eskiz={eskiz} canEdit={canEdit} />

      <ConfirmModal
        open={decide !== null}
        onOpenChange={(o) => !o && setDecide(null)}
        title={decide?.paid ? t.paidTitle : t.cancelTitle}
        message={
          decide
            ? decide.paid
              ? t.paidText(decide.row.project, sms(decide.row.parts), som(decide.row.price))
              : t.cancelText(decide.row.project, decide.row.packageName)
            : ""
        }
        confirmLabel={decide?.paid ? t.markPaid : t.cancel}
        onConfirm={() =>
          decide &&
          run(
            () => decideSmsPurchaseAction({ id: decide.row.id, paid: decide.paid }),
            decide.paid ? t.paidDone : t.cancelDone,
          )
        }
      />
      {canEdit ? (
        <>
          <PackageModal value={pkg} onClose={() => setPkg(null)} />
          <AdjustModal wallet={adjust} onClose={() => setAdjust(null)} />
        </>
      ) : null}
    </div>
  );
}

function EskizCard({
  eskiz,
  canEdit,
}: {
  eskiz: { email: string | null; sender: string | null; connected: boolean };
  canEdit: boolean;
}) {
  const { run, pending } = useRun();
  const [form, setForm] = React.useState({ email: eskiz.email ?? "", secret: "", sender: eskiz.sender ?? "" });
  return (
    <Section title={t.eskizTitle}>
      <Card className="space-y-4 p-5">
        <p className="text-body text-muted-foreground">
          {eskiz.connected ? t.eskizConnected(eskiz.email ?? "") : t.eskizHint}
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => connectSmsEskizAction(form),
              t.eskizSaved,
              () => setForm((f) => ({ ...f, secret: "" })),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="sms-eskiz-email">{t.email}</Label>
              <Input
                id="sms-eskiz-email"
                type="email"
                autoComplete="off"
                value={form.email}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sms-eskiz-secret">{t.secret}</Label>
              <Input
                id="sms-eskiz-secret"
                type="password"
                autoComplete="new-password"
                value={form.secret}
                disabled={!canEdit}
                placeholder={eskiz.connected ? t.secretKeep : ""}
                onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sms-eskiz-sender">{t.sender}</Label>
              <Input
                id="sms-eskiz-sender"
                value={form.sender}
                maxLength={20}
                placeholder="4546"
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))}
              />
            </div>
          </div>
          <FieldHint>{t.secretHint}</FieldHint>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {t.save}
              </Button>
            </div>
          ) : null}
        </form>
      </Card>
    </Section>
  );
}

function PackageModal({ value, onClose }: { value: PackageRow | "new" | null; onClose: () => void }) {
  const { run, pending } = useRun();
  const editing = value && value !== "new" ? value : null;
  const [form, setForm] = React.useState({ name: "", parts: "", price: null as number | null, active: true });
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const key = value ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key)
      setForm({
        name: editing?.name ?? "",
        parts: editing ? String(editing.parts) : "",
        price: editing?.price ?? null,
        active: editing?.active ?? true,
      });
  }
  return (
    <Modal
      open={value !== null}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? t.packageEdit : t.packageAdd}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="sms-package-form" disabled={pending}>
            {t.save}
          </Button>
        </>
      }
    >
      <form
        id="sms-package-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              saveSmsPackageAction({
                id: editing?.id,
                name: form.name,
                parts: Number(form.parts),
                price: form.price ?? 0,
                active: form.active,
              }),
            t.packageSaved,
            onClose,
          );
        }}
      >
        <div>
          <Label htmlFor="sms-pkg-name">{t.colName}</Label>
          <Input
            id="sms-pkg-name"
            value={form.name}
            placeholder={t.packageNamePlaceholder}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sms-pkg-parts">{t.colParts}</Label>
            <Input
              id="sms-pkg-parts"
              inputMode="numeric"
              value={form.parts}
              onChange={(e) => setForm((f) => ({ ...f, parts: e.target.value.replace(/\D/g, "") }))}
            />
          </div>
          <div>
            <Label htmlFor="sms-pkg-price">{t.colPrice}</Label>
            <MoneyInput
              id="sms-pkg-price"
              value={form.price}
              onValueChange={(v) => setForm((f) => ({ ...f, price: v }))}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-body text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          {t.activeHint}
        </label>
      </form>
    </Modal>
  );
}

function AdjustModal({ wallet, onClose }: { wallet: WalletRow | null; onClose: () => void }) {
  const { run, pending } = useRun();
  const [delta, setDelta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  if ((wallet?.id ?? null) !== openedFor) {
    setOpenedFor(wallet?.id ?? null);
    setDelta("");
    setNote("");
  }
  return (
    <Modal
      open={wallet !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t.adjustTitle}
      description={wallet ? `${wallet.name} · ${sms(wallet.balance)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="sms-adjust-form" disabled={pending}>
            {t.save}
          </Button>
        </>
      }
    >
      <form
        id="sms-adjust-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (wallet)
            run(
              () => adjustSmsWalletAction({ projectId: wallet.id, delta: Number(delta), note }),
              t.adjustDone,
              onClose,
            );
        }}
      >
        <div>
          <Label htmlFor="sms-adjust-delta">{t.adjustDelta}</Label>
          <Input
            id="sms-adjust-delta"
            inputMode="numeric"
            value={delta}
            placeholder="500 / -100"
            onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))}
          />
          <FieldHint>{t.adjustHint}</FieldHint>
        </div>
        <div>
          <Label htmlFor="sms-adjust-note">{t.adjustNote}</Label>
          <Input id="sms-adjust-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}

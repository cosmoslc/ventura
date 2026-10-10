"use client";

import { Copy, MoreHorizontal, Plus, Send, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { type AccessState, ROLE_LABELS } from "@ventura/auth/policy";
import { ROLES, type Role } from "@ventura/db/schema/panel";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardHeader } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { changeRoleAction, createAdminAction, resetTelegramAction, unlockAction } from "../actions";

interface AdminRow {
  id: string;
  name: string;
  phone: string;
  role: Role;
  roleLabel: string;
  state: AccessState;
}

const ROLE_TONE = { super_admin: "info", admin: "success", viewer: "neutral" } as const;

export function AdminsView({ rows, meId }: { rows: AdminRow[]; meId: string }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [resetFor, setResetFor] = React.useState<AdminRow | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);

  const done = (r: { ok: boolean; error?: string }, title: string) => {
    if (r.ok) {
      toast({ tone: "success", title });
      router.refresh();
    } else toast({ tone: "danger", title: r.error ?? uz.common.loadError });
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <span className="text-body text-muted-foreground">{rows.length}</span>
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> {uz.settings.addAdmin}
          </Button>
        </CardHeader>
        <TableWrap>
          <Table className="min-w-[720px]">
            <THead>
              <tr>
                <Th>{uz.clients.name}</Th>
                <Th>{uz.auth.phone}</Th>
                <Th>{uz.settings.role}</Th>
                <Th>{uz.settings.state}</Th>
                <Th className="text-right">{uz.common.actions}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const me = r.id === meId;
                return (
                  <Tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size={32} />
                        <span className="text-body font-bold text-foreground">
                          {r.name}
                          {me ? (
                            <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                              ({uz.settings.you})
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono">{r.phone}</span>
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONE[r.role]}>{r.roleLabel}</Badge>
                    </Td>
                    <Td>
                      {r.state === "locked" ? (
                        <Badge tone="danger" dot>
                          {uz.settings.locked}
                        </Badge>
                      ) : r.state === "ok" ? (
                        <Badge tone="success" dot>
                          {uz.settings.active}
                        </Badge>
                      ) : (
                        <Badge tone="warning" dot>
                          {uz.settings.pendingSetup}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      {me ? null : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="subtle" size="icon-sm" aria-label={`${r.name} — ${uz.common.actions}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>
                              <span className="type-eyebrow text-muted-foreground">{uz.settings.role}</span>
                            </DropdownMenuLabel>
                            {ROLES.filter((role) => role !== r.role).map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onSelect={async () => done(await changeRoleAction(r.id, role), uz.common.saved)}
                              >
                                → {ROLE_LABELS[role]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            {r.state === "locked" ? (
                              <DropdownMenuItem
                                onSelect={async () => done(await unlockAction(r.id), uz.settings.unlock)}
                              >
                                <Unlock /> {uz.settings.unlock}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              danger
                              onSelect={() => {
                                setResetFor(r);
                                setResetOpen(true);
                              }}
                            >
                              <Send /> {uz.settings.resetTelegram}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <AddAdminDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(password) => {
          setAddOpen(false);
          setTempPassword(password);
          router.refresh();
        }}
      />

      <Modal
        open={!!tempPassword}
        onOpenChange={(o) => !o && setTempPassword(null)}
        position="center"
        title={uz.settings.tempPasswordTitle}
        description={uz.settings.tempPasswordHint}
        footer={<Button onClick={() => setTempPassword(null)}>{uz.common.back}</Button>}
      >
        <div className="flex gap-2">
          <Input
            value={tempPassword ?? ""}
            readOnly
            className="font-mono text-lg tracking-wider"
            aria-label={uz.settings.tempPasswordTitle}
          />
          <Button
            variant="icon"
            size="icon"
            aria-label={uz.wizard.copy}
            onClick={() => {
              void navigator.clipboard.writeText(tempPassword ?? "");
              toast({ tone: "info", title: uz.wizard.copied });
            }}
          >
            <Copy />
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={uz.settings.resetTelegram}
        message={resetFor ? `${resetFor.name} — ${uz.settings.resetTelegramConfirm}` : ""}
        confirmLabel={uz.settings.resetTelegram}
        onConfirm={async () => {
          if (resetFor) done(await resetTelegramAction(resetFor.id), uz.settings.resetTelegram);
        }}
      />
    </>
  );
}

function AddAdminDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (password: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState<Role>("admin");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const submit = () =>
    start(async () => {
      const r = await createAdminAction({ name, phone, role });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName("");
      setPhone("");
      setError(null);
      onCreated(r.password);
    });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={uz.settings.addAdmin}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={submit} disabled={pending || name.trim().length < 2 || phone.length !== 9}>
            {uz.common.create}
          </Button>
        </>
      }
    >
      {error ? <FieldHint error>{error}</FieldHint> : null}
      <div>
        <Label htmlFor="a-name">{uz.clients.name}</Label>
        <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <Label htmlFor="a-phone">{uz.auth.phone}</Label>
        <PhoneInput id="a-phone" value={phone} onValueChange={setPhone} />
      </div>
      <div>
        <Label>{uz.settings.role}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger aria-label={uz.settings.role}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Modal>
  );
}

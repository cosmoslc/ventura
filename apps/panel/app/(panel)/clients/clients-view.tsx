"use client";

import { Pencil, Plus, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardHeader } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PhoneInput, formatUzPhone } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { EmptyState } from "@ventura/ui/page-header";
import { formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import { saveClientAction } from "./actions";

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  note: string | null;
  status: "active" | "inactive";
  createdAt: string;
  projects: number;
}

export function ClientsView({ rows, canWrite, openNew }: { rows: ClientRow[]; canWrite: boolean; openNew: boolean }) {
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<ClientRow | null>(null);
  const [open, setOpen] = React.useState(openNew && canWrite);

  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((r) => [r.name, r.company, r.phone].some((v) => v?.toLowerCase().includes(q))) : rows;

  const startNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="w-full sm:w-72">
            <Input
              icon={<Search />}
              placeholder={uz.common.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={uz.common.search}
            />
          </div>
          {canWrite ? (
            <Button onClick={startNew}>
              <Plus /> {uz.clients.add}
            </Button>
          ) : null}
        </CardHeader>
        {visible.length ? (
          <TableWrap>
            <Table className="min-w-[720px]">
              <THead>
                <tr>
                  <Th>{uz.clients.name}</Th>
                  <Th>{uz.clients.phone}</Th>
                  <Th>{uz.clients.projects}</Th>
                  <Th>{uz.clients.status}</Th>
                  <Th>{uz.clients.created}</Th>
                  {canWrite ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size={32} />
                        <div className="min-w-0">
                          <div className="truncate text-body font-bold text-foreground">{r.name}</div>
                          {r.company ? (
                            <div className="truncate text-caption text-muted-foreground">{r.company}</div>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono">{r.phone ? `+998 ${formatUzPhone(r.phone.slice(4))}` : "—"}</span>
                    </Td>
                    <Td>
                      <span className="font-mono">{r.projects}</span>
                    </Td>
                    <Td>
                      <Badge tone={r.status === "active" ? "success" : "neutral"} dot>
                        {uz.clients.statusLabels[r.status]}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="font-mono">{formatDate(r.createdAt)}</span>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <Button
                          variant="subtle"
                          size="icon-sm"
                          aria-label={`${r.name} — ${uz.common.edit}`}
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
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
          <EmptyState
            icon={<Users />}
            title={q ? uz.common.empty : uz.clients.empty}
            description={q ? undefined : uz.clients.emptyHint}
            action={
              !q && canWrite ? (
                <Button onClick={startNew}>
                  <Plus /> {uz.clients.add}
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {canWrite ? (
        <ClientDrawer key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} client={editing} />
      ) : null}
    </>
  );
}

function ClientDrawer({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: ClientRow | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = React.useState(client?.phone?.slice(4) ?? "");
  const [status, setStatus] = React.useState<string>(client?.status ?? "active");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const submit = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("phone", phone);
    data.set("status", status);
    if (client) data.set("id", client.id);
    start(async () => {
      const r = await saveClientAction(data);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast({ tone: "success", title: client ? uz.common.saved : uz.clients.createdOk });
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={client ? uz.clients.edit : uz.clients.add}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {uz.common.save}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {error ? <FieldHint error>{error}</FieldHint> : null}
        <div>
          <Label htmlFor="c-name">{uz.clients.name}</Label>
          <Input id="c-name" name="name" defaultValue={client?.name} required autoFocus />
        </div>
        <div>
          <Label htmlFor="c-company">{uz.clients.company}</Label>
          <Input id="c-company" name="company" defaultValue={client?.company ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-phone">{uz.clients.phone}</Label>
          <PhoneInput
            id="c-phone"
            value={phone}
            onValueChange={setPhone}
            invalid={phone.length > 0 && phone.length !== 9}
          />
        </div>
        <div>
          <Label>{uz.clients.status}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label={uz.clients.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{uz.clients.statusLabels.active}</SelectItem>
              <SelectItem value="inactive">{uz.clients.statusLabels.inactive}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="c-note">{uz.clients.note}</Label>
          <Textarea id="c-note" name="note" defaultValue={client?.note ?? ""} />
        </div>
      </form>
    </Modal>
  );
}

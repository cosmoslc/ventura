"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { addServerAction } from "./actions";

const EMPTY = { name: "", host: "", port: "22", user: "deploy", kind: "online" as "online" | "home" };

/** Server qo'shish: panel kalit yaratadi, keyin server sahifasida o'rnatish buyrug'i ko'rsatiladi. */
export function AddServerForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [form, setForm] = React.useState(EMPTY);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addServerAction({
        name: form.name.trim(),
        host: form.host.trim(),
        sshPort: Number(form.port),
        sshUser: form.user.trim(),
        kind: form.kind,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.servers.created, description: form.name });
      onOpenChange(false);
      router.push(`/servers/${res.id}`);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={uz.servers.formTitle}
      description={uz.servers.formHint}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="server-form" disabled={pending}>
            <Plus /> {uz.servers.create}
          </Button>
        </>
      }
    >
      <form id="server-form" onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="server-name">{uz.servers.name}</Label>
          <Input
            id="server-name"
            autoFocus
            className="font-mono"
            placeholder={uz.servers.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value.toLowerCase())}
          />
          <FieldHint>{uz.servers.nameHint}</FieldHint>
        </div>
        <div>
          <Label>{uz.servers.kindLabel}</Label>
          <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">{uz.servers.kind.online}</SelectItem>
              <SelectItem value="home">{uz.servers.kind.home}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="server-host">{uz.servers.host}</Label>
          <Input
            id="server-host"
            className="font-mono"
            placeholder={uz.servers.hostPlaceholder}
            value={form.host}
            onChange={(e) => set("host", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="server-port">{uz.servers.port}</Label>
            <Input
              id="server-port"
              inputMode="numeric"
              className="font-mono"
              value={form.port}
              onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </div>
          <div>
            <Label htmlFor="server-user">{uz.servers.user}</Label>
            <Input
              id="server-user"
              className="font-mono"
              value={form.user}
              onChange={(e) => set("user", e.target.value)}
            />
          </div>
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}

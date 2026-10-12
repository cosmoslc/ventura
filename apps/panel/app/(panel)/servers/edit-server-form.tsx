"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { ServerCard } from "@/lib/server/servers-query";
import { uz } from "@/lib/uz";
import { updateServerAction } from "./actions";

function initial(s: ServerCard) {
  return {
    name: s.name,
    kind: s.kind,
    host: s.host,
    port: String(s.sshPort),
    user: s.sshUser,
    deployRoot: s.deployRoot,
    capacity: s.capacity ? String(s.capacity) : "",
    note: s.note ?? "",
  };
}

/** Server ma'lumotini tahrirlash. Manzil o'zgarsa, keyingi "Tekshirish" yangi server kalitini qabul qiladi. */
export function EditServerForm({
  server,
  open,
  onOpenChange,
}: {
  server: ServerCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(() => initial(server));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(initial(server));
      setError(null);
    }
  }
  const hasApps = server.apps.length > 0;

  const set = (k: keyof ReturnType<typeof initial>, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateServerAction(server.id, {
        name: form.name.trim(),
        kind: form.kind,
        host: form.host.trim(),
        sshPort: Number(form.port),
        sshUser: form.user.trim(),
        deployRoot: form.deployRoot.trim(),
        capacity: form.capacity ? Number(form.capacity) : null,
        note: form.note,
      });
      if (!res.ok) return setError(res.error);
      toast({
        tone: res.reconnect ? "info" : "success",
        title: uz.servers.updated,
        ...(res.reconnect ? { description: uz.servers.reconnectHint } : {}),
      });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={uz.servers.editTitle(server.name)}
      position="center"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="server-edit-form" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        </>
      }
    >
      <form id="server-edit-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="se-name">{uz.servers.name}</Label>
          <Input
            id="se-name"
            className="font-mono"
            value={form.name}
            onChange={(e) => set("name", e.target.value.toLowerCase())}
          />
        </div>
        <div>
          <Label htmlFor="se-host">{uz.servers.host}</Label>
          <Input id="se-host" className="font-mono" value={form.host} onChange={(e) => set("host", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="se-port">{uz.servers.port}</Label>
          <Input
            id="se-port"
            inputMode="numeric"
            className="font-mono"
            value={form.port}
            onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
        </div>
        <div>
          <Label htmlFor="se-user">{uz.servers.user}</Label>
          <Input id="se-user" className="font-mono" value={form.user} onChange={(e) => set("user", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="se-root">{uz.servers.deployRoot}</Label>
          <Input
            id="se-root"
            className="font-mono"
            value={form.deployRoot}
            disabled={hasApps}
            onChange={(e) => set("deployRoot", e.target.value)}
          />
          <FieldHint>{uz.servers.deployRootHint}</FieldHint>
        </div>
        <div>
          <Label htmlFor="se-capacity">{uz.servers.capacity}</Label>
          <Input
            id="se-capacity"
            inputMode="numeric"
            className="font-mono"
            placeholder={uz.servers.capacityPlaceholder}
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <FieldHint>{uz.servers.capacityHint}</FieldHint>
        </div>
        <div className="sm:col-span-2">
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
        <div className="sm:col-span-2">
          <Label htmlFor="se-note">{uz.servers.note}</Label>
          <Textarea
            id="se-note"
            placeholder={uz.servers.notePlaceholder}
            value={form.note}
            maxLength={500}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
        {error ? (
          <FieldHint error className="sm:col-span-2">
            {error}
          </FieldHint>
        ) : null}
      </form>
    </Modal>
  );
}

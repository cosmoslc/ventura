"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";

/**
 * Sabablar ro'yxatini tahrirlash (lid yo'qotish — ADR 0022, guruhdan chiqish — ADR 0031): qo'shish va o'chirish,
 * kamida bitta sabab qoladi. Saqlash amali chaqiruvchidan keladi.
 */
export function ReasonsModal({
  open,
  onOpenChange,
  reasons,
  save,
  text,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: string[];
  save: (list: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  text: { title: string; intro: string; add: string; placeholder: string; saved: string };
  onSaved?: (list: string[]) => void;
}) {
  const router = useRouter();
  const [list, setList] = React.useState(reasons);
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setList(reasons);
      setDraft("");
    }
  }
  function add() {
    const v = draft.trim();
    if (!v || list.includes(v)) return;
    setList([...list, v]);
    setDraft("");
  }
  function submit() {
    startTransition(async () => {
      const res = await save(list);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: text.saved });
      onSaved?.(list);
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={text.title}
      description={text.intro}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={submit} disabled={pending || !list.length}>
            {uz.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="space-y-2">
          {list.map((r) => (
            <li
              key={r}
              className="flex items-center justify-between gap-2 rounded-control border border-border-soft px-3 py-2"
            >
              <span className="text-body text-foreground">{r}</span>
              <Button
                variant="icon"
                size="icon-sm"
                className="text-destructive-text"
                aria-label={`${r} — ${uz.common.delete}`}
                disabled={list.length < 2}
                onClick={() => setList(list.filter((x) => x !== r))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            aria-label={text.add}
            placeholder={text.placeholder}
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button variant="ghost" onClick={add} disabled={!draft.trim()}>
            <Plus /> {text.add}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

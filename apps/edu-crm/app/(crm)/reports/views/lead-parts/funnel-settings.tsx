"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { uz } from "@/lib/uz";
import { saveFunnelStagesAction } from "../../funnel-actions";

const k = uz.reports.funnel;

/**
 * Voronkada ko'rinadigan bosqichlar: har ochiq bosqich uchun belgi, o'zgarish darhol saqlanadi (markaz sozlamasi,
 * hamma xodimga). Yashirilgan bosqich voronka, ko'rsatkichlar va jadvallardan chiqadi — o'tish va tushish ko'rinadigan
 * oldingi bosqichga nisbatan. Yakuniy bosqich ro'yxatda yo'q: u doim ko'rinadi.
 */
export function FunnelSettings({ stages }: { stages: FunnelViewData["stages"] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [hidden, setHidden] = React.useState(() => new Set(stages.filter((s) => s.hidden).map((s) => s.id)));
  // Server yangi holat bergach mahalliy holat unga tenglashadi
  const [seen, setSeen] = React.useState(stages);
  if (seen !== stages) {
    setSeen(stages);
    setHidden(new Set(stages.filter((s) => s.hidden).map((s) => s.id)));
  }

  function toggle(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const before = hidden;
    setHidden(next);
    startTransition(async () => {
      const res = await saveFunnelStagesAction({ hidden: [...next] });
      if (!res.ok) {
        setHidden(before);
        return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      }
      toast({ tone: "success", title: k.settingsSaved });
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Settings2 /> {k.settings}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        position="center"
        title={k.settings}
        description={k.settingsIntro}
        footer={<Button onClick={() => setOpen(false)}>{k.settingsClose}</Button>}
      >
        <ul className="space-y-3">
          {stages.map((s) => (
            <li key={s.id}>
              <ChoiceField
                control={
                  <Checkbox checked={!hidden.has(s.id)} disabled={pending} onCheckedChange={() => toggle(s.id)} />
                }
                label={
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

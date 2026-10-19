"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Label } from "@ventura/ui/label";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import { GRADE_SCALES, type GradingSettings } from "@/lib/grades";
import { uz } from "@/lib/uz";
import { saveGradingSettingsAction } from "./actions";

const t = uz.gradingSettings;

export function GradingSettingsView({ settings, canEdit }: { settings: GradingSettings; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = React.useState(settings);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveGradingSettingsAction(form);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} />
      <Card className="max-w-2xl p-5">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>{t.scale}</Label>
            <RadioGroup
              value={String(form.scale)}
              onValueChange={(v) => setForm({ scale: Number(v) as GradingSettings["scale"] })}
              disabled={!canEdit}
            >
              {GRADE_SCALES.map((s) => (
                <RadioCard key={s} value={String(s)} title={t.scales[s]!.title} description={t.scales[s]!.hint} />
              ))}
            </RadioGroup>
          </div>
          {form.scale !== settings.scale ? <Notice tone="warning">{t.changeWarn}</Notice> : null}
          {canEdit ? (
            <Button type="submit" disabled={pending}>
              <Check /> {uz.common.save}
            </Button>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

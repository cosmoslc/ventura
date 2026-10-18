"use client";

import { Pencil } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { PageHeader } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { toast } from "@ventura/ui/toast";
import { cn } from "@ventura/ui/lib/utils";
import type { ReasonCategoryId, ReasonsConfig, SwitchableCategoryId } from "@/lib/reasons";
import { uz } from "@/lib/uz";
import { forgetReasonsConfig } from "../reason-field";
import { forgetLeaveReasons } from "../groups/leave-reason-fields";
import { ReasonsModal } from "../reasons-modal";
import { saveReasonListAction, saveReasonSwitchAction } from "./actions";

/*
 * Sabablar (ADR 0035): har tur uchun bitta karta — ro'yxat, "Tahrirlash" va (bor turlarda) "Sabab so'ralsin"
 * yoqgichi. Bo'limlar bo'yicha guruhlangan: o'quvchilar, guruhlar, lidlar.
 */

interface Category {
  id: ReasonCategoryId;
  feature: "students" | "groups" | "leads";
  switchable: boolean;
  canEdit: boolean;
}

const SECTIONS = ["students", "groups", "leads"] as const;

export function ReasonsView({ categories, config }: { categories: Category[]; config: ReasonsConfig }) {
  const t = uz.reasons;
  const [editing, setEditing] = React.useState<ReasonCategoryId | null>(null);
  // Oxirgi tahrirlangan tur: yopilish animatsiyasida sarlavha o'zgarmasligi uchun
  const [last, setLast] = React.useState<ReasonCategoryId>("student_active");
  const [switches, setSwitches] = React.useState(config.switches);
  const [lists, setLists] = React.useState(config.lists);
  const [pending, startTransition] = React.useTransition();

  function open(id: ReasonCategoryId) {
    setLast(id);
    setEditing(id);
  }

  function toggle(id: SwitchableCategoryId, enabled: boolean) {
    setSwitches((s) => ({ ...s, [id]: enabled }));
    startTransition(async () => {
      const res = await saveReasonSwitchAction({ category: id, enabled });
      if (!res.ok) {
        setSwitches((s) => ({ ...s, [id]: !enabled }));
        return void toast({ tone: "danger", title: res.error });
      }
      forgetReasonsConfig();
      toast({ tone: "success", title: t.switchSaved });
    });
  }

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-5">
        {SECTIONS.map((section) => {
          const items = categories.filter((c) => c.feature === section);
          if (!items.length) return null;
          return (
            <section key={section} className="space-y-3">
              <h2 className="type-heading text-title text-foreground">{t.sections[section]}</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {items.map((c) => {
                  const asks = c.switchable ? switches[c.id as SwitchableCategoryId] : true;
                  return (
                    <Card key={c.id}>
                      <CardHeader className="items-start">
                        <div className="min-w-0 flex-1">
                          <CardTitle>{t.categories[c.id]!.title}</CardTitle>
                          <CardDescription>{t.categories[c.id]!.intro}</CardDescription>
                        </div>
                        {c.canEdit ? (
                          <Button variant="ghost" size="sm" onClick={() => open(c.id)}>
                            <Pencil /> {t.edit}
                          </Button>
                        ) : null}
                      </CardHeader>
                      <div className="space-y-4 p-5">
                        {c.switchable ? (
                          <label className="flex items-center justify-between gap-3">
                            <span>
                              <span className="block text-body text-foreground">{t.askLabel}</span>
                              {!asks ? (
                                <span className="block text-body text-muted-foreground">{t.askOffHint}</span>
                              ) : null}
                            </span>
                            <Switch
                              checked={asks}
                              disabled={!c.canEdit || pending}
                              onCheckedChange={(v) => toggle(c.id as SwitchableCategoryId, v)}
                            />
                          </label>
                        ) : null}
                        <ul
                          className={cn(
                            "flex flex-wrap gap-1.5 transition-opacity duration-200",
                            !asks && "opacity-50",
                          )}
                        >
                          {lists[c.id].map((r) => (
                            <li
                              key={r}
                              className="rounded-btn border border-border-soft px-2.5 py-1 text-body text-foreground"
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <ReasonsModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        reasons={lists[last]}
        save={(list) => saveReasonListAction({ category: last, list })}
        onSaved={(list) => {
          setLists((l) => ({ ...l, [last]: list }));
          forgetReasonsConfig();
          if (last === "leave") forgetLeaveReasons();
        }}
        text={{
          title: t.categories[last]!.title,
          intro: t.modalIntro,
          add: t.add,
          placeholder: t.placeholder,
          saved: t.saved,
        }}
      />
    </div>
  );
}

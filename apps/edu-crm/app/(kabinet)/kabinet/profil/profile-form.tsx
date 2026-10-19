"use client";

import { Check, User } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { PageHeader } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { saveKabinetProfileAction } from "../actions";

const t = uz.kabinet;

export function ProfileForm({
  teacher,
}: {
  teacher: { name: string; phone: string; gender: "male" | "female" | null; birthDate: string };
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(teacher);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveKabinetProfileAction({
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
      });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader title={t.profileTitle} description={t.profileDescription} />
      <Card className="max-w-2xl p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <h2 className="type-heading text-base sm:col-span-2">{t.personalTitle}</h2>
          <div className="sm:col-span-2">
            <Label htmlFor="kabinet-name">{t.name}</Label>
            <Input
              id="kabinet-name"
              icon={<User />}
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="kabinet-phone">{t.phone}</Label>
            <Input id="kabinet-phone" value={form.phone} disabled readOnly />
            <FieldHint>{t.phoneHint}</FieldHint>
          </div>
          <div>
            <Label>{t.gender}</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.gender}>
              {(["male", "female"] as const).map((g) => (
                <Button
                  key={g}
                  role="radio"
                  aria-checked={form.gender === g}
                  variant={form.gender === g ? "primary" : "ghost"}
                  onClick={() => setForm((f) => ({ ...f, gender: g }))}
                >
                  {g === "male" ? t.male : t.female}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="kabinet-birth">{t.birthDate}</Label>
            <Input
              id="kabinet-birth"
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              <Check /> {uz.common.save}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

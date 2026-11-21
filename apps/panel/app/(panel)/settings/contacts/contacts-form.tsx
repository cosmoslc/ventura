// Muallif / Agent: Google Gemini
"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { toast } from "@ventura/ui/toast";
import type { CrmContacts } from "@/lib/server/crm-contacts";
import { saveCrmContactsAction } from "../actions";

export function ContactsForm({ contacts, canEdit }: { contacts: CrmContacts; canEdit: boolean }) {
  const [formData, setFormData] = React.useState(contacts);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await saveCrmContactsAction(formData);
      if (res.ok) {
        toast({
          title: "Muvaffaqiyatli saqlandi",
          description: "crm.ventura.uz landing sahifasidagi aloqa ma'lumotlari yangilandi",
          tone: "success",
        });
      } else {
        toast({ title: "Xatolik", description: res.error, tone: "danger" });
      }
    } catch (err) {
      toast({ title: "Xatolik", description: (err as Error).message, tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phonePrimary">Asosiy telefon raqam *</Label>
          <Input
            id="phonePrimary"
            required
            disabled={!canEdit}
            value={formData.phonePrimary}
            onChange={(e) => setFormData({ ...formData, phonePrimary: e.target.value })}
            placeholder="+998 71 200 45 45"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phoneSecondary">Qo'shimcha telefon raqam</Label>
          <Input
            id="phoneSecondary"
            disabled={!canEdit}
            value={formData.phoneSecondary}
            onChange={(e) => setFormData({ ...formData, phoneSecondary: e.target.value })}
            placeholder="+998 90 998 45 45"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="telegramSupport">Telegram yordam / menejer</Label>
          <Input
            id="telegramSupport"
            disabled={!canEdit}
            value={formData.telegramSupport}
            onChange={(e) => setFormData({ ...formData, telegramSupport: e.target.value })}
            placeholder="@ventura_support"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telegramChannel">Telegram kanal</Label>
          <Input
            id="telegramChannel"
            disabled={!canEdit}
            value={formData.telegramChannel}
            onChange={(e) => setFormData({ ...formData, telegramChannel: e.target.value })}
            placeholder="@ventura_uz"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">Elektron pochta (Email)</Label>
          <Input
            id="email"
            type="email"
            disabled={!canEdit}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="crm@ventura.uz"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workHours">Ish vaqti va tartibi *</Label>
          <Input
            id="workHours"
            required
            disabled={!canEdit}
            value={formData.workHours}
            onChange={(e) => setFormData({ ...formData, workHours: e.target.value })}
            placeholder="Dushanba — Shanba: 09:00 — 19:00"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Bosh ofis manzili *</Label>
        <Input
          id="address"
          required
          disabled={!canEdit}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Toshkent shahri, Yunusobod tumani, Amir Temur shoh ko'chasi, 107-B uy"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mapUrl">Xarita havolasi (Yandex Maps / Google Maps)</Label>
        <Input
          id="mapUrl"
          disabled={!canEdit}
          value={formData.mapUrl ?? ""}
          onChange={(e) => setFormData({ ...formData, mapUrl: e.target.value })}
          placeholder="https://yandex.uz/maps/-/..."
        />
      </div>

      {canEdit && (
        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "O'zgarishlarni saqlash"}
          </Button>
        </div>
      )}
    </form>
  );
}

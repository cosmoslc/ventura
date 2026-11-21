"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import { createUserAction } from "./actions";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

export function UserDialog({ open, onOpenChange, locale }: UserDialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("+998");
  const [role, setRole] = React.useState<"owner" | "accountant" | "viewer">("accountant");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setName("");
    setPhone("+998");
    setRole("accountant");
    setPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("role", role);
    formData.append("password", password);

    const res = await createUserAction(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || t("status_error", locale));
      return;
    }

    reset();
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={t("users_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="user-name">{t("users_name", locale)} *</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ali Valiyev"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-phone">{t("users_phone", locale)} *</Label>
          <Input
            id="user-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998901234567"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-role">{t("users_role", locale)} *</Label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "owner" | "accountant" | "viewer")}
            className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="owner">{t("role_owner", locale)}</option>
            <option value="accountant">{t("role_accountant", locale)}</option>
            <option value="viewer">{t("role_viewer", locale)}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-password">{t("users_password", locale)} *</Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kamida 8 ta belgi"
            required
            minLength={8}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("action_cancel", locale)}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("status_loading", locale) : t("action_save", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

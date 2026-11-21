"use client";

import { Check, KeyRound, Send, ShieldCheck, ShieldOff, User } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { toast } from "@ventura/ui/toast";
import { changePortalPasswordAction, togglePortal2FAAction, updatePortalNicknameAction } from "./actions";
import { uz } from "@/lib/uz";

interface SettingsProps {
  initialName: string;
  phone: string;
  twoFactorEnabled: boolean;
  hasTelegram: boolean;
}

/**
 * O'quvchi sozlamalari sahifasi (ADR 0063).
 * Ism/taxallus, parol va Telegram 2FA sozlamalari.
 * Muallif / Agent: Google Gemini
 */
export function PortalSettingsView({ initialName, phone, twoFactorEnabled, hasTelegram }: SettingsProps) {
  const router = useRouter();

  // 1. Ism
  const [name, setName] = React.useState(initialName);
  const [savingName, startNameTransition] = React.useTransition();

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startNameTransition(async () => {
      const res = await updatePortalNicknameAction({ name });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: uz.portal.ismMuvaffaqiyatliYangilandi });
      router.refresh();
    });
  }

  // 2. Parol
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingPassword, startPasswordTransition] = React.useTransition();

  function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return void toast({ tone: "danger", title: uz.portal.yangiParollarBirBiriga });
    }
    startPasswordTransition(async () => {
      const res = await changePortalPasswordAction({ currentPassword, newPassword });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: uz.portal.parolMuvaffaqiyatliAlmashtirildi });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  // 3. 2FA
  const [toggling2FA, start2FATransition] = React.useTransition();

  function handleToggle2FA(enable: boolean) {
    start2FATransition(async () => {
      const res = await togglePortal2FAAction(enable);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      if (res.needTelegram) {
        toast({ tone: "info", title: uz.portal.avvalTelegramBotgaUlanishingiz });
        router.push("/connect-telegram");
        return;
      }
      toast({ tone: "success", title: enable ? uz.portal.t2faMuvaffaqiyatliYoqildi : uz.portal.t2faOchirildi });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="type-heading text-title text-foreground">Xavfsizlik va Profil</h1>
        <p className="text-body text-muted-foreground">Shaxsiy ma'lumotlaringiz, login paroli va hisob himoyasi</p>
      </div>

      {/* 1. Profil va Ism */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="size-5 text-primary" />
          <h2 className="text-subheading font-bold text-foreground">Shaxsiy ma'lumotlar</h2>
        </div>

        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <Label htmlFor="portal-name">{uz.portal.ismYokiTaxallus}</Label>
            <Input
              id="portal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={uz.portal.ismingizniKiriting}
              required
            />
          </div>

          <div>
            <Label htmlFor="portal-phone">{uz.portal.telefonRaqamiLogin}</Label>
            <Input id="portal-phone" value={phone} disabled className="opacity-70 bg-muted cursor-not-allowed" />
            <FieldHint>{uz.portal.telefonRaqaminiFaqatMarkaz}</FieldHint>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savingName || name === initialName}>
              Saqlash
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. Parolni almashtirish */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h2 className="text-subheading font-bold text-foreground">Parolni almashtirish</h2>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-3">
          <div>
            <Label htmlFor="current-pass">{uz.portal.hozirgiParol}</Label>
            <Input
              id="current-pass"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="new-pass">{uz.portal.yangiParol}</Label>
            <Input
              id="new-pass"
              type="password"
              autoComplete="new-password"
              placeholder={uz.portal.kamida6Belgi}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="confirm-pass">{uz.portal.yangiParolniTasdiqlang}</Label>
            <Input
              id="confirm-pass"
              type="password"
              autoComplete="new-password"
              placeholder={uz.portal.yangiParolniQaytaTering}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            >
              {uz.portal.parolniYangilash}
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. Telegram 2FA himoyasi */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-subheading font-bold text-foreground">Ikki bosqichli tasdiqlash (2FA)</h2>
          </div>
          <Badge tone={twoFactorEnabled ? "success" : "neutral"}>
            {twoFactorEnabled ? uz.portal.on : uz.portal.off}
          </Badge>
        </div>

        <p className="text-caption text-muted-foreground leading-relaxed">
          {uz.portal.ikkiBosqichliTasdiqlashYoqilganda}
          {uz.portal.orqaliYuboriladiganMaxsusTasdiq}
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-caption font-semibold">
            {hasTelegram ? (
              <span className="text-foreground flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> Telegram bot ulangan
              </span>
            ) : (
              <span className="text-warning-fg flex items-center gap-1.5">
                <Send className="size-4" /> Telegram hisob hali ulanmagan
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!hasTelegram ? (
              <Button variant="subtle" size="sm" onClick={() => router.push("/connect-telegram")}>
                <Send className="size-3.5 mr-1" /> Botga ulanish
              </Button>
            ) : twoFactorEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive-text"
                disabled={toggling2FA}
                onClick={() => handleToggle2FA(false)}
              >
                <ShieldOff className="size-3.5 mr-1" /> 2FA ni o'chirish
              </Button>
            ) : (
              <Button size="sm" disabled={toggling2FA} onClick={() => handleToggle2FA(true)}>
                <ShieldCheck className="size-3.5 mr-1" /> 2FA ni yoqish
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

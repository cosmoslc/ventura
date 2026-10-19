"use client";

import { KeyRound, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { grantTeacherLoginAction, resetTeacherPasswordAction, revokeTeacherLoginAction } from "./actions";
import type { TeacherPerms } from "./teachers-view";

const t = uz.teacherLogin;

/**
 * O'qituvchi profilidagi "Kabinetga kirish" (ADR 0062): holati, kirish berish yoki parolni yangilash (parol shu yerda
 * yoziladi) va kirishni o'chirish. O'qituvchi birinchi kirishda parolni almashtiradi.
 */
export function TeacherLoginCard({
  teacherId,
  hasLogin,
  perms,
}: {
  teacherId: string;
  hasLogin: boolean;
  perms: TeacherPerms;
}) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const canSet = hasLogin ? perms.edit : perms.create;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = hasLogin
        ? await resetTeacherPasswordAction({ teacherId, password })
        : await grantTeacherLoginAction({ teacherId, password });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      setPassword("");
      toast({ tone: "success", title: hasLogin ? t.resetDone : t.granted });
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeTeacherLoginAction(teacherId);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.revoked });
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caption font-bold tracking-wide text-muted-foreground uppercase">{t.title}</h2>
        <Badge tone={hasLogin ? "success" : "neutral"}>{hasLogin ? t.on : t.off}</Badge>
      </div>
      {canSet ? (
        <form onSubmit={submit} className="space-y-2">
          <Label htmlFor="teacher-login-password">{hasLogin ? t.newPassword : t.password}</Label>
          <div className="flex gap-2">
            <Input
              id="teacher-login-password"
              type="password"
              autoComplete="new-password"
              icon={<KeyRound />}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={pending || !password}>
              {hasLogin ? <KeyRound /> : <LogIn />} {hasLogin ? t.reset : t.grant}
            </Button>
          </div>
          <FieldHint>{t.hint}</FieldHint>
        </form>
      ) : null}
      {hasLogin && perms.delete ? (
        <Button variant="ghost" className="text-destructive-text" disabled={pending} onClick={() => setConfirm(true)}>
          <LogOut /> {t.revoke}
        </Button>
      ) : null}
      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title={t.revoke}
        message={t.revokeConfirm}
        confirmLabel={t.revoke}
        onConfirm={revoke}
      />
    </section>
  );
}

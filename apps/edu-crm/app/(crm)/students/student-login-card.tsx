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
import { grantStudentLoginAction, resetStudentPasswordAction, revokeStudentLoginAction } from "./actions";

const t = uz.studentLogin;

/**
 * O'quvchi profilidagi "O'quvchi kabineti" (ADR 0063): holati, kirish berish yoki parolni yangilash
 * va kirishni o'chirish. O'quvchi telefon raqami va shu parol bilan portalga kiradi.
 * Muallif / Agent: Google Gemini
 */
export function StudentLoginCard({
  studentId,
  hasLogin,
  perms,
}: {
  studentId: string;
  hasLogin: boolean;
  perms: { create: boolean; edit: boolean; delete: boolean };
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
        ? await resetStudentPasswordAction({ studentId, password })
        : await grantStudentLoginAction({ studentId, password });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      setPassword("");
      toast({ tone: "success", title: hasLogin ? t.resetDone : t.granted });
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokeStudentLoginAction(studentId);
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.revoked });
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-card border border-border-soft bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caption font-bold tracking-wide text-muted-foreground uppercase">{t.title}</h2>
        <Badge tone={hasLogin ? "success" : "neutral"}>{hasLogin ? t.on : t.off}</Badge>
      </div>
      {canSet ? (
        <form onSubmit={submit} className="space-y-2">
          <Label htmlFor="student-login-password">{hasLogin ? t.newPassword : t.password}</Label>
          <div className="flex gap-2">
            <Input
              id="student-login-password"
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

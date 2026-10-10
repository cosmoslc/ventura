"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { uz } from "@/lib/uz";
import { type FormState, changePasswordAction } from "../../actions";
import { FormMessage } from "../../auth-card";

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      {!forced ? (
        <div>
          <Label htmlFor="current">{uz.auth.currentPassword}</Label>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
      ) : null}
      <div>
        <Label htmlFor="next">{uz.auth.newPassword}</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <Label htmlFor="confirm">{uz.auth.confirmPassword}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {uz.auth.save}
      </Button>
      {!forced ? (
        <Link href="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
          {uz.common.back}
        </Link>
      ) : null}
    </form>
  );
}

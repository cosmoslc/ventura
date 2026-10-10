"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { uz } from "@/lib/uz";
import { type FormState, sendCodeAction, verifyCodeAction } from "../../actions";
import { FormMessage } from "../../auth-card";

const COOLDOWN = 60;

export function VerifyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyCodeAction, {});
  const [sendState, setSendState] = useState<FormState>({});
  const [left, setLeft] = useState(COOLDOWN);
  const [sending, startSending] = useTransition();
  const sentOnce = useRef(false);

  const send = () =>
    startSending(async () => {
      setSendState(await sendCodeAction());
      setLeft(COOLDOWN);
    });

  // Sahifa ochilganda kod bir marta avtomatik yuboriladi
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
  }, []);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const message = state.error ? state : sendState;

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={message.error} info={message.info} />
      <div>
        <Label htmlFor="code">{uz.auth.code}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          className="text-center font-mono text-lg tracking-[0.5em]"
          autoFocus
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {uz.auth.verify}
      </Button>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={send}
          disabled={left > 0 || sending}
          className="cursor-pointer font-semibold text-primary-text disabled:cursor-default disabled:text-muted-foreground"
        >
          {left > 0 ? uz.auth.resendIn(left) : uz.auth.resend}
        </button>
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          {uz.auth.backToLogin}
        </Link>
      </div>
    </form>
  );
}

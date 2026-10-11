"use client";

import { ExternalLink } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { uz } from "@/lib/uz";
import { type FormState, checkLinkAction, linkTokenAction } from "../actions";
import { FormMessage } from "../auth-card";
import { useFormNext } from "../use-form-next";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-caption font-bold text-primary-text">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">{children}</div>
    </div>
  );
}

export function ConnectForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(checkLinkAction, {});
  useFormNext(state);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    linkTokenAction().then((r) => {
      if (!alive) return;
      if ("url" in r) setLink(r.url);
      else setLinkError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <form action={action} className="space-y-5">
      <FormMessage error={state.error ?? linkError} />
      <Step n={1}>
        <div className="text-body font-semibold text-foreground">{uz.auth.connectStep1}</div>
        <Button variant="ghost" className="w-full" asChild disabled={!link}>
          <a href={link ?? "#"} target="_blank" rel="noreferrer">
            {uz.auth.openBot} <ExternalLink />
          </a>
        </Button>
      </Step>
      <Step n={2}>
        <div className="text-body font-semibold text-foreground">{uz.auth.connectStep2}</div>
        <div>
          <Label htmlFor="password">{uz.auth.password}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !link}>
          {uz.auth.check}
        </Button>
      </Step>
    </form>
  );
}

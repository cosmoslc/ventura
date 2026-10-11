"use client";

import { useActionState, useState } from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { PhoneInput } from "@ventura/ui/phone-input";
import { uz } from "@/lib/uz";
import { type FormState, signInAction } from "../actions";
import { FormMessage } from "../auth-card";
import { useFormNext } from "../use-form-next";

export function LoginForm({ info }: { info?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, { info });
  useFormNext(state);
  const [phone, setPhone] = useState("");

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} info={state.info} />
      <div>
        <Label htmlFor="phone">{uz.auth.phone}</Label>
        <PhoneInput id="phone" value={phone} onValueChange={setPhone} autoFocus required />
        <input type="hidden" name="phone" value={phone} />
      </div>
      <div>
        <Label htmlFor="password">{uz.auth.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending || phone.length !== 9}>
        {uz.auth.submit}
      </Button>
    </form>
  );
}

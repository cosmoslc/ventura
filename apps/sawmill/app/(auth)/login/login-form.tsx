"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { PhoneInput } from "@ventura/ui/phone-input";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { type Locale, t } from "@/lib/i18n";
import { type FormState, loginAction } from "./actions";

export function LoginForm({ initialLocale = "uz" }: { initialLocale?: Locale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const res = await loginAction(prev, formData);
      if (res.next) {
        router.push(res.next);
        router.refresh();
      }
      return res;
    },
    {},
  );
  const [phone, setPhone] = useState("");

  return (
    <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale("uz")}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              locale === "uz"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            UZ
          </button>
          <button
            type="button"
            onClick={() => setLocale("ru")}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              locale === "ru"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            RU
          </button>
        </div>
        <ThemeToggle />
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t("login_title", locale)}</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5">{t("login_subtitle", locale)}</p>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && (
          <div className="p-3 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("login_phone_label", locale)}</Label>
          <PhoneInput id="phone" value={phone} onValueChange={setPhone} autoFocus required />
          <input type="hidden" name="phone" value={phone} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("login_password_label", locale)}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        <Button type="submit" className="w-full mt-2" disabled={isPending || phone.length !== 9}>
          {isPending ? t("login_submitting", locale) : t("login_button", locale)}
        </Button>
      </form>
    </div>
  );
}

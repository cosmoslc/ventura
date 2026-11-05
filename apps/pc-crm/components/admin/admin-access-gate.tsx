"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { FieldHint, Label } from "@ventura/ui/label";
import { Input } from "@ventura/ui/input";
import { normalizeUzPhone } from "@/lib/phone";
import { authClient } from "@/lib/auth-client";

export function AdminAccessGate({ signedIn, adminExists }: { signedIn: boolean; adminExists: boolean }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phoneNumber = normalizeUzPhone(phone);
    if (!phoneNumber) {
      setError("Telefon raqamini +998 90 123 45 67 formatida kiriting.");
      return;
    }
    if (password.length < 12) {
      setError("Parol kamida 12 belgidan iborat bo'lishi kerak.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await authClient.signIn.phoneNumber({ phoneNumber, password });
    if (result.error) {
      setError("Telefon yoki parol noto'g'ri. Admin hisob terminal orqali yaratilganini tekshiring.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader className="justify-start gap-4 px-6 py-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-primary-text">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <CardTitle>Admin paneliga kirish</CardTitle>
            <CardDescription>
              {signedIn
                ? "Joriy hisobda admin huquqi yoʻq. Admin hisobidan chiqib, telefon/parol admin hisobi bilan kiring."
                : adminExists
                  ? "Admin hisobi topildi. Terminalda shu hisob uchun kiritilgan telefon va paroldan foydalaning."
                  : "Admin hisob terminal orqali yaratiladi. Hisob mavjud bo'lsa, terminalga kiritilgan telefon va parol bilan kiring."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-6">
        {signedIn ? (
          <>
            <Button asChild variant="primary" className="mt-6 gap-2">
              <Link href="/">Bosh sahifaga qaytish</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Panelga adminning telefon raqami va paroli bilan kiring.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="admin-phone">Telefon raqami</Label>
                <Input
                  id="admin-phone"
                  type="tel"
                  autoComplete="username"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+998 90 123 45 67"
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-password">Parol</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Admin paroli"
                  required
                />
              </div>
              {error && <FieldHint role="alert" error>{error}</FieldHint>}
              <Button type="submit" variant="primary" disabled={busy} className="w-full gap-2">
                {busy ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
                {busy ? "Tekshirilmoqda…" : "Admin sifatida kirish"}
              </Button>
            </form>
            <FieldHint className="mt-5 border-t border-border pt-4">
              {adminExists
                ? "Agar telefon/parol qabul qilinmasa, telefonni terminalda ishlatilgan shaklda kiriting yoki parolni tekshiring."
                : <>Admin hisobini yaratish uchun Ventura terminalida <code className="rounded bg-muted px-1.5 py-0.5 font-mono">pnpm pc:admin:create</code> buyrugʻini bajaring.</>}
            </FieldHint>
          </>
        )}
        </CardContent>
      </Card>
    </main>
  );
}

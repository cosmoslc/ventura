"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { FieldHint, Label } from "@ventura/ui/label";
import { Input } from "@ventura/ui/input";
import { normalizeUzPhone } from "@/lib/phone";
import { authClient, signOut } from "@/lib/auth-client";

export function AdminAccessGate({ signedIn }: { signedIn: boolean; adminExists: boolean }) {
  const [identifier, setIdentifier] = useState("+998902021479");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await signOut();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identifier.trim()) {
      setError("Telefon raqami yoki email kiriting.");
      return;
    }

    if (!password.trim()) {
      setError("Parolni kiriting.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      // Agar avvaldan boshqa (oddiy) sessiya mavjud bo'lsa, tozalash
      if (signedIn) {
        await signOut().catch(() => {});
      }

      let res: { error?: { message?: string } | null } = {};

      // 1. Email orqali tekshirish
      if (identifier.includes("@")) {
        res = await authClient.signIn.email({
          email: identifier.trim(),
          password: password.trim(),
        });
      } else {
        // 2. Telefon raqami orqali tekshirish
        const phoneNumber = normalizeUzPhone(identifier);
        if (!phoneNumber) {
          setError("Telefon raqamini toʻgʻri formatda kiriting (masalan: +998 90 202 14 79).");
          setBusy(false);
          return;
        }

        res = await authClient.signIn.phoneNumber({
          phoneNumber,
          password: password.trim(),
        });

        // Agar telefon orqali topilmasa, admin+phone@pc-crm.invalid orqali ham sinab ko'rish
        if (res.error) {
          const fallbackEmail = `admin+${phoneNumber.replace(/\D/g, "")}@pc-crm.invalid`;
          const emailRes = await authClient.signIn.email({
            email: fallbackEmail,
            password: password.trim(),
          });
          if (!emailRes.error) {
            res = emailRes;
          }
        }
      }

      if (res.error) {
        setError(res.error.message || "Telefon/email yoki parol notoʻgʻri.");
        setBusy(false);
        return;
      }

      // Muvaffaqiyatli: admin panelga yo'naltirish
      window.location.href = "/admin";
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "") || "Kirishda xatolik yuz berdi.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-lg shadow-modal border-border">
        <CardHeader className="justify-start gap-4 px-6 py-5 border-b border-border">
          <div className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-primary-text">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Admin paneliga kirish</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Ventura PC doʻkoni boshqaruv tizimi
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 py-6 space-y-5">
          {/* Agar boshqa hisobda kiringan bo'lsa ogohlantirish */}
          {signedIn && (
            <div className="rounded-control border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 space-y-2">
              <p className="font-semibold">
                Siz hozirda oddiy foydalanuvchi hisobi bilan tizimdasiz (admin huquqi yoʻq).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  className="gap-1.5 text-2xs h-7 border border-amber-500/40 text-amber-800 dark:text-amber-300"
                >
                  <LogOut size={12} />
                  <span>{loggingOut ? "Chiqilmoqda..." : "Joriy hisobdan chiqish"}</span>
                </Button>
                <Link
                  href="/"
                  className="text-2xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft size={12} /> Bosh sahifaga
                </Link>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Admin telefon raqami (yoki email) va parolingizni kiriting:</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-identifier" className="text-xs font-semibold">
                Telefon raqami yoki Email
              </Label>
              <Input
                id="admin-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="+998 90 202 14 79 yoki admin@venturapc.uz"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-xs font-semibold">
                Parol
              </Label>
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

            {error && (
              <FieldHint role="alert" error>
                {error}
              </FieldHint>
            )}

            <Button type="submit" variant="primary" disabled={busy} className="w-full gap-2 font-bold mt-2">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <KeyRound size={16} />}
              <span>{busy ? "Tekshirilmoqda…" : "Admin sifatida kirish"}</span>
            </Button>
          </form>

          <div className="border-t border-border pt-4 text-2xs text-muted-foreground flex items-center justify-between">
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Doʻkon bosh sahifasiga qaytish
            </Link>
            <span className="font-mono text-muted-foreground/60">Ventura PC Admin</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

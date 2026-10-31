"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { authClient, signIn, signUp } from "@/lib/auth-client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ isOpen, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setSuccessMsg("");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  // 1. Google OAuth orqali kirish
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: typeof window !== "undefined" ? window.location.href : "/profile",
      });
      if (res?.error) {
        setErrorMsg(
          res.error.message ||
            "Google OAuth sozlanmagan. Iltimos, .env faylida GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET parametrlarini kiriting."
        );
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Google OAuth xatosi. Iltimos, GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET sozlanganligini tekshiring."
      );
      setIsLoading(false);
    }
  };

  // 2. Email & Parol orqali kirish / ro'yxatdan o'tish
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Iltimos, barcha maydonlarni toʻldiring.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setErrorMsg("Iltimos, ismingizni kiriting.");
          setIsLoading(false);
          return;
        }

        const res = await signUp.email({
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
        });

        if (res.error) {
          setErrorMsg(res.error.message || "Roʻyxatdan oʻtishda xatolik yuz berdi.");
          setIsLoading(false);
          return;
        }

        setSuccessMsg("Hisob muvaffaqiyatli yaratildi! Tizimga kirilmoqda...");
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 800);
      } else {
        const res = await signIn.email({
          email: email.trim(),
          password: password.trim(),
        });

        if (res.error) {
          setErrorMsg(res.error.message || "Email yoki parol notoʻgʻri.");
          setIsLoading(false);
          return;
        }

        setSuccessMsg("Muvaffaqiyatli kirildi!");
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Xatolik yuz berdi.");
      setIsLoading(false);
    }
  };

  // 4. Tezkor Demo / Test hisob bilan kirish (1 bosishda)
  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // Avval mavjud test akkauntga kirishga urinish
      let res = await signIn.email({
        email: "test@ventura.uz",
        password: "password123",
      });

      // Agar hali yaratilmagan bo'lsa, yaratish
      if (res.error) {
        await signUp.email({
          email: "test@ventura.uz",
          password: "password123",
          name: "Sardorbek Alimov",
        });
      }

      setSuccessMsg("Test hisobi bilan kirildi!");
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 700);
    } catch {
      setErrorMsg("Tezkor kirishda xatolik yuz berdi.");
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal oynasi */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "login" ? "Tizimga kirish" : "Yangi hisob yaratish"}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 text-foreground"
      >
        {/* Yopish tugmasi */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        {/* Sarlavha va Logo */}
        <div className="text-center pb-5">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound size={24} />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {mode === "login" ? "Tizimga kirish" : "Yangi hisob yaratish"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "login"
              ? "Buyurtmalarni kuzatish va tezkor xarid uchun hisobingizga kiring"
              : "Ventura PC doʻkonida shaxsiy hisobingizni oching"}
          </p>
        </div>

        {/* Xato yoki muvaffaqiyat xabari */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. OAUTH TUGMASI (Google) */}
        <div>
          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background py-2.5 px-4 text-xs font-bold text-foreground transition-all hover:bg-secondary hover:border-primary/40 disabled:opacity-60 shadow-xs cursor-pointer"
          >
            {/* Google rangli G logosi */}
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google orqali kirish</span>
          </button>
        </div>

        {/* Bo'luvchi chiziq */}
        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="relative bg-card px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            yoki email orqali
          </span>
        </div>

        {/* 2. EMAIL & PAROL FORMASI */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Toʻliq ismingiz
              </label>
              <div className="relative flex items-center">
                <User size={15} className="absolute left-3 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: Sardorbek Alimov"
                  className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Elektron pochta (Email)
            </label>
            <div className="relative flex items-center">
              <Mail size={15} className="absolute left-3 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nomi@gmail.com"
                className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Parol
            </label>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 ta belgi"
                className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="w-full mt-2 font-bold text-xs py-2.5 shadow-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Yuklanmoqda...
              </span>
            ) : mode === "login" ? (
              "Kirish"
            ) : (
              "Roʻyxatdan oʻtish"
            )}
          </Button>
        </form>

        {/* 3. TEZKOR TEST LOGIN (Dev) */}
        <div className="mt-3 pt-3 border-t border-border/70">
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            <Zap size={14} />
            <span>Tezkor test hisob bilan kirish (1 bosishda)</span>
          </button>
        </div>

        {/* Mode almashtirish (Kirish <-> Ro'yxatdan o'tish) */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "login" ? (
            <p>
              Hisobingiz yoʻqmi?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="font-bold text-primary hover:underline ml-1"
              >
                Roʻyxatdan oʻting
              </button>
            </p>
          ) : (
            <p>
              Hisobingiz bormi?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-bold text-primary hover:underline ml-1"
              >
                Kirish
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
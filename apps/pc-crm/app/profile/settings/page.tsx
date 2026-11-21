"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, KeyRound, Lock, MapPin, Save, User } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { useSession } from "@/lib/auth-client";

export default function ProfileSettingsPage() {
  const { data: session, isPending } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("Toshkent shahri");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      if (session.user.name) {
        const parts = session.user.name.trim().split(" ");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessiya holatiga qarab ma'lumotni tozalash/yuklash
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      if (session.user.email) {
        setEmail(session.user.email);
      }
      if (session.user.image) {
        setAvatarUrl(session.user.image);
      }
    }
  }, [session]);

  // Parolni o'zgartirish modali
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Saqlandi xabari
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || newPassword !== confirmPassword) return;

    setPasswordSuccess(true);
    setTimeout(() => {
      setIsPasswordModalOpen(false);
      setPasswordSuccess(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 1500);
  };

  const userInitials =
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() ||
    (session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U");

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="rounded-card border border-border bg-card p-5">
        <h1 className="text-2xl font-black tracking-tight">Profil sozlamalari</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Shaxsiy maʼlumotlar, yetkazib berish manzili va xavfsizlik sozlamalari
        </p>
      </div>

      {/* Muvaffaqiyat bildirishnomasi */}
      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-control bg-(--success-bg) border border-(--success-border) p-4 text-xs sm:text-sm text-(--success-fg)">
          <CheckCircle2 size={18} />
          <span>Profil maʼlumotlari muvaffaqiyatli yangilandi!</span>
        </div>
      )}

      {/* Forma yoki Skeleton */}
      {isPending ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-card border border-border bg-card p-5 space-y-4">
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-muted shrink-0" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-40 bg-muted rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* 1. Shaxsiy ma'lumotlar va Rasm */}
          <div className="rounded-card border border-border bg-card p-5 space-y-5">
            <h2 className="font-bold text-base flex items-center gap-2">
              <User size={18} className="text-primary" />
              Asosiy maʼlumotlar
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-5 pb-4 border-b border-border">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-2xl border-2 border-primary/20">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  userInitials
                )}
                <label className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card hover:scale-110 transition-transform">
                  <Camera size={14} />
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAvatarUrl(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>

              <div className="space-y-1 text-center sm:text-left">
                <h3 className="font-bold text-sm">Profil rasmi</h3>
                <p className="text-xs text-muted-foreground">JPG, PNG formatida maksimal 2 MB</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-xs text-(--danger-fg) hover:underline font-semibold"
                  >
                    Rasmni oʻchirish
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ism *</Label>
                <Input
                  required
                  value={firstName}
                  placeholder="Ismingizni kiriting"
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Familiya *</Label>
                <Input
                  required
                  value={lastName}
                  placeholder="Familiyangizni kiriting"
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Telefon raqam *
                </Label>
                <Input
                  required
                  value={phone}
                  placeholder="+998 90 123 45 67"
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Elektron pochta
                </Label>
                <Input
                  type="email"
                  value={email}
                  placeholder="namuna@domain.uz"
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Yetkazib berish manzili va Yandex Xarita */}
          <div className="rounded-card border border-border bg-card p-5 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              Standart yetkazib berish manzili
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Viloyat / Shahar
                </Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger aria-label="Viloyat / Shahar" className="w-full text-xs h-(--control-h)">
                    <SelectValue placeholder="Viloyatni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Toshkent shahri">Toshkent shahri</SelectItem>
                    <SelectItem value="Toshkent viloyati">Toshkent viloyati</SelectItem>
                    <SelectItem value="Samarqand viloyati">Samarqand viloyati</SelectItem>
                    <SelectItem value="Fargʻona viloyati">Fargʻona viloyati</SelectItem>
                    <SelectItem value="Andijon viloyati">Andijon viloyati</SelectItem>
                    <SelectItem value="Buxoro viloyati">Buxoro viloyati</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Toʻliq manzil (koʻcha, uy, xonadon)
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Masalan: Chilonzor tumani, 9-mavze, 14-uy"
                />
              </div>
            </div>

            {/* Yandex Xarita (Iframe) */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Xaritadagi joylashuv (Geolokatsiya)
              </Label>
              <div className="h-56 w-full overflow-hidden rounded-card border border-border">
                <iframe
                  title="Yandex Maps Joylashuv"
                  src="https://yandex.uz/map-widget/v1/?ll=69.2401%2C41.2995&z=13"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  loading="lazy"
                  className="h-full w-full grayscale-[20%]"
                />
              </div>
              <p className="text-caption text-muted-foreground">
                Xaritadan uyingiz yoki ofisingizni belgilashingiz mumkin, kuryer shu nuqta boʻyicha yetkazadi.
              </p>
            </div>
          </div>

          {/* 3. Xavfsizlik bo'limi */}
          <div className="rounded-card border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-bold text-sm flex items-center gap-2">
                <KeyRound size={16} className="text-primary" />
                Kirish paroli
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Parolingiz xavfsizligini taʼminlash uchun uni har 3-6 oyda yangilab turing.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPasswordModalOpen(true)}
              className="text-xs font-semibold gap-1.5"
            >
              <Lock size={14} />
              Parolni oʻzgartirish
            </Button>
          </div>

          {/* Saqlash tugmasi */}
          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="default" className="gap-2 font-bold shadow-control">
              <Save size={16} />
              Oʻzgarishlarni saqlash
            </Button>
          </div>
        </form>
      )}

      {/* Parolni o'zgartirish modali */}
      <Modal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
        title="Parolni oʻzgartirish"
        footer={
          passwordSuccess ? (
            <Button variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
              Yopish
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" form="change-password-form" variant="primary">
                Yangilash
              </Button>
            </>
          )
        }
      >
        {passwordSuccess ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 size={36} className="text-(--success-fg) mx-auto" />
            <h3 className="font-bold text-base">Parol muvaffaqiyatli yangilandi!</h3>
          </div>
        ) : (
          <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4 text-xs sm:text-sm">
            <div>
              <Label htmlFor="old-password">Joriy parol *</Label>
              <Input
                id="old-password"
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="new-password">Yangi parol *</Label>
              <Input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="confirm-password">Yangi parolni tasdiqlang *</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

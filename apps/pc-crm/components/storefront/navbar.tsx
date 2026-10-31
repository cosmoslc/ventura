"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Heart,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  Search,
  ShoppingBag,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { useSession, signOut } from "@/lib/auth-client";
import { AuthModal } from "./auth-modal";
import { NavbarSearch } from "./navbar-search";
import { NotificationsDrawer } from "./notifications-drawer";

interface NavbarProps {
  cartCount?: number;
  likedCount?: number;
  unreadNotifsCount?: number;
  onOpenCart?: () => void;
  onOpenSearch?: () => void;
}

export function Navbar({
  cartCount: propCartCount,
  likedCount: propLikedCount,
  unreadNotifsCount = 0,
  onOpenCart: propOnOpenCart,
  onOpenSearch: propOnOpenSearch,
}: NavbarProps) {
  const { cartCount: contextCartCount, setIsCartDrawerOpen, setIsSearchOpen } = useCart();
  const { likedCount: contextLikedCount } = useLiked();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");
  const [locale, setLocale] = useState<"uz" | "ru" | "en">("uz");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cartCount = propCartCount ?? contextCartCount;
  const likedCount = propLikedCount ?? contextLikedCount;
  const onOpenCart = propOnOpenCart ?? (() => setIsCartDrawerOpen(true));
  const onOpenSearch = propOnOpenSearch ?? (() => setMobileSearchOpen((v) => !v));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      {/* Yuqori yupqa tasma (Top bar) */}
      <div className="border-b border-border/50 bg-muted/40 py-1 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-[var(--storefront-max-w,1320px)] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <span>Yetkazib berish butun Oʻzbekiston boʻylab</span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="hidden sm:inline">Aloqa: +998 71 200 00 00</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Valyuta */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrency(currency === "UZS" ? "USD" : "UZS")}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {currency}
              </button>
            </div>

            <span className="text-border">|</span>

            {/* Til */}
            <div className="flex items-center gap-1.5 uppercase font-semibold">
              {(["uz", "ru", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  className={`transition-colors ${locale === l ? "text-primary underline font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Asosiy navigatsiya qatori */}
      <div className="mx-auto flex max-w-[var(--storefront-max-w,1320px)] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-foreground font-black text-xl tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r-btn,8px)] bg-primary text-primary-foreground shadow-sm">
            <Monitor size={20} />
          </div>
          <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">
            VENTURA<span className="text-primary font-normal">PC</span>
          </span>
        </Link>

        {/* Qidiruv input (Ikki tomonga va pastga qarab kengayuvchi) */}
        <div className="hidden md:flex mx-2">
          <NavbarSearch />
        </div>

        {/* Menyu havolalari (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-foreground">
          <Link href="/products" className="transition-colors hover:text-primary">
            Mahsulotlar
          </Link>
          <Link href="/computers" className="transition-colors hover:text-primary">
            Kompyuterlar
          </Link>
          <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
            FAQ
          </Link>
          <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
            Biz haqimizda
          </Link>
        </nav>

        {/* O'ng tomon amallar (Theme, Bildirishnomalar, Sevimlilar, Savatcha, Profil) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobil qidiruv ikonka */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            aria-label="Qidirish"
            className={`md:hidden relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs ${
              mobileSearchOpen ? "border-primary text-primary bg-primary/10" : ""
            }`}
          >
            <Search size={18} />
          </button>

          {/* Dark / Light toggle */}
          <ThemeToggle className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs" />

          {/* Bildirishnomalar */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-label="Bildirishnomalar"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs"
          >
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
              {unreadNotifsCount > 0 ? unreadNotifsCount : 2}
            </span>
          </button>

          {/* Sevimlilar */}
          <Link
            href="/profile/liked"
            aria-label="Sevimlilar"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs"
          >
            <Heart size={18} />
            {likedCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {likedCount}
              </span>
            )}
          </Link>

          {/* Savatcha */}
          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Xarid savatchasi"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
                {cartCount}
              </span>
            )}
          </button>

          {/* Profil yoki Kirish */}
          <div ref={profileDropdownRef} className="relative">
            {session?.user ? (
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-label="Profil"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs overflow-hidden"
              >
                {session.user.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-xs text-primary">
                    {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                aria-label="Profil"
                title="Tizimga kirish"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs"
              >
                <User size={18} />
              </button>
            )}

            {/* Profil ochiluvchi menyusi */}
            {profileDropdownOpen && session?.user && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                {/* Foydalanuvchi ma'lumotlari */}
                <div className="border-b border-border/80 px-3 py-2.5">
                  <p className="font-bold text-xs text-foreground truncate">
                    {session.user.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                  <span className="mt-1.5 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary capitalize">
                    {(session.user as any).role || "Mijoz"}
                  </span>
                </div>

                {/* Menyu bandlari */}
                <div className="py-1 text-xs font-semibold text-foreground space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
                  >
                    <User size={14} className="text-muted-foreground" />
                    <span>Mening profilim</span>
                  </Link>

                  <Link
                    href="/profile/orders"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
                  >
                    <ShoppingBag size={14} className="text-muted-foreground" />
                    <span>Buyurtmalarim</span>
                  </Link>

                  <Link
                    href="/profile/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
                  >
                    <KeyRound size={14} className="text-muted-foreground" />
                    <span>Sozlamalar</span>
                  </Link>

                  {(session.user as any).role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Sparkles size={14} />
                      <span>Admin paneli</span>
                    </Link>
                  )}
                </div>

                {/* Chiqish (Logout) */}
                <div className="border-t border-border/80 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setProfileDropdownOpen(false);
                      window.location.reload();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut size={14} />
                    <span>Tizimdan chiqish</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobil burger menyu tugmasi */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menyu"
            className="lg:hidden relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all shadow-xs"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobil qidiruv qatori (pastga ochiladi) */}
      {mobileSearchOpen && (
        <div className="border-t border-border bg-card px-4 py-3 md:hidden">
          <NavbarSearch isMobile onCloseMobile={() => setMobileSearchOpen(false)} />
        </div>
      )}

      {/* Mobil menyu drawer/dropdown */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-card px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 font-semibold text-foreground">
            <Link
              href="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary transition-colors"
            >
              Mahsulotlar
            </Link>
            <Link
              href="/computers"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary transition-colors"
            >
              Kompyuterlar
            </Link>
            <Link
              href="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-muted-foreground hover:text-foreground"
            >
              FAQ
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-muted-foreground hover:text-foreground"
            >
              Biz haqimizda
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 rounded-[var(--r-btn,8px)] border border-border bg-secondary/50 py-2 text-center text-xs font-bold text-foreground hover:bg-secondary"
            >
              Boshqaruv paneliga oʻtish (Admin)
            </Link>
          </nav>
        </div>
      )}

      {/* Bildirishnomalar o'ng paneli (Drawer) */}
      <NotificationsDrawer isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      {/* Auth Modal (Google OAuth, GitHub, Email/Parol) */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}

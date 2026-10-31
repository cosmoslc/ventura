"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Cpu,
  ExternalLink,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { ThemeToggle } from "@ventura/ui/theme-toggle";

interface AdminShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Boshqaruv paneli", href: "/admin", icon: LayoutDashboard },
  { label: "Mahsulotlar", href: "/admin/products", icon: Boxes },
  { label: "Kirimlar (Ombor)", href: "/admin/purchases", icon: PackagePlus },
  { label: "Sotuvlar & Foyda", href: "/admin/sales", icon: Receipt },
  { label: "PClar (Tayyor)", href: "/admin/pcs", icon: Monitor },
  { label: "PC Zakazlar", href: "/admin/pc-orders", icon: Wrench },
  { label: "Buyurtmalar", href: "/admin/orders", icon: ShoppingCart },
  { label: "Foydalanuvchilar", href: "/admin/users", icon: Users },
  { label: "Sozlamalar", href: "/admin/settings", icon: Settings },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* 1. Desktop Chap Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-border bg-card p-4">
        <div>
          {/* Logo */}
          <div className="mb-6 flex items-center justify-between px-2">
            <Link href="/admin" className="flex items-center gap-2 font-black text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-btn,8px)] bg-primary text-primary-foreground shadow-sm">
                <Monitor size={18} />
              </div>
              <span className="tracking-tight">
                VENTURA<span className="text-primary font-normal">PC</span>
              </span>
            </Link>
            <Badge tone="info" className="text-[10px] font-bold uppercase">
              Admin
            </Badge>
          </div>

          {/* Menyu bandlari */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[var(--r-btn,8px)] px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pastki qism: Do'konga o'tish va Profil */}
        <div className="border-t border-border pt-4">
          <Link
            href="/"
            target="_blank"
            className="mb-3 flex items-center justify-between rounded-[var(--r-btn,8px)] border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={14} />
              Doʻkonga oʻtish
            </span>
            <span className="text-[10px] text-muted-foreground">↗</span>
          </Link>

          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                A
              </div>
              <div>
                <p className="font-bold leading-none text-foreground">Super Admin</p>
                <p className="text-[10px] text-muted-foreground">Doʻkon egasi</p>
              </div>
            </div>

            <Link href="/" title="Chiqish" className="text-muted-foreground hover:text-rose-500 transition-colors">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </aside>

      {/* 2. Mobil Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex w-72 flex-col justify-between bg-card p-5 shadow-2xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <Link href="/admin" className="flex items-center gap-2 font-black text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-btn,8px)] bg-primary text-primary-foreground">
                    <Monitor size={18} />
                  </div>
                  <span>VENTURAPC Admin</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-[var(--r-btn,8px)] px-3 py-2.5 text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-border pt-4">
              <Link
                href="/"
                target="_blank"
                className="flex items-center justify-center gap-2 rounded-[var(--r-btn,8px)] border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                <ExternalLink size={14} />
                Doʻkon saytiga oʻtish
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* 3. Asosiy Qism (Header + Sahifa kontenti) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-secondary"
            >
              <Menu size={18} />
            </button>
            <span className="text-xs font-bold text-muted-foreground">
              Boshqaruv Paneli
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" target="_blank" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                <ExternalLink size={13} />
                Doʻkon
              </Button>
            </Link>
          </div>
        </header>

        {/* Sahifa ichki qismi */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

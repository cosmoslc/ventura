"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  TreePine,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { logoutAction } from "@/app/(auth)/login/actions";
import { type Locale, t } from "@/lib/i18n";
import { setLocaleAction } from "@/lib/i18n/actions";
import type { SawmillUser } from "@/lib/server/session";
import { QuickActionsModal } from "./quick-actions-modal";

interface ShellProps {
  tenantName: string;
  user: SawmillUser;
  enabledFeatures: string[];
  children: React.ReactNode;
}

export function Shell({ tenantName, user, enabledFeatures, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [quickActionOpen, setQuickActionOpen] = React.useState(false);
  const [locale, setLocale] = React.useState<Locale>(user.locale ?? "uz");

  // Navigatsiya bandlari
  const navSections = [
    {
      title: t("nav_group_main", locale),
      items: [
        { label: t("nav_home", locale), href: "/", icon: LayoutDashboard, feature: "teraks" },
        { label: t("nav_teraks", locale), href: "/teraks", icon: TreePine, feature: "teraks" },
        { label: t("nav_work", locale), href: "/work", icon: Briefcase, feature: "work" },
      ],
    },
    {
      title: t("nav_group_operations", locale),
      items: [
        { label: t("nav_materials", locale), href: "/materials", icon: Layers, feature: "stock" },
        { label: t("nav_dispatch", locale), href: "/dispatch", icon: Truck, feature: "dispatch" },
        { label: t("nav_trucks", locale), href: "/trucks", icon: Truck, feature: "trucks" },
      ],
    },
    {
      title: t("nav_group_finance", locale),
      items: [
        { label: t("nav_workers", locale), href: "/workers", icon: Users, feature: "workers" },
        { label: t("nav_expenses", locale), href: "/expenses", icon: Receipt, feature: "general_expenses" },
      ],
    },
    {
      title: t("nav_group_analytics", locale),
      items: [
        { label: t("nav_reports", locale), href: "/reports", icon: BarChart3, feature: "reports" },
        { label: t("nav_settings", locale), href: "/settings", icon: Settings, feature: "teraks" },
      ],
    },
  ];

  // Faqat yoqilgan bo'limlarni ko'rsatish
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => enabledFeatures.includes(item.feature)),
    }))
    .filter((section) => section.items.length > 0);

  const roleLabels: Record<string, string> = {
    owner: t("role_owner", locale),
    accountant: t("role_accountant", locale),
    viewer: t("role_viewer", locale),
  };

  const roleTones: Record<string, "info" | "success" | "neutral" | "warning"> = {
    owner: "info",
    accountant: "success",
    viewer: "neutral",
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[var(--sidebar-w)] flex-col fixed inset-y-0 z-30 bg-card border-r border-border">
        {/* Brand header */}
        <div className="h-[var(--topbar-h)] flex items-center justify-between px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-btn bg-primary flex items-center justify-center text-primary-foreground shadow-xs font-bold text-lg">
              P
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground leading-tight truncate max-w-[140px]">
                {tenantName}
              </span>
              <span className="text-caption text-muted-foreground font-medium">
                {t("app_name", locale)}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {filteredSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h3 className="px-3 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                {section.title}
              </h3>
              <div className="space-y-0.5 mt-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-nav text-body font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick action button inside sidebar */}
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={() => setQuickActionOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-btn bg-primary text-primary-foreground font-semibold text-caption shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>{t("quick_actions", locale)}</span>
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col lg:pl-[var(--sidebar-w)] min-w-0">
        {/* Top bar */}
        <header className="h-[var(--topbar-h)] sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 bg-[var(--topbar-bg)] backdrop-blur-[14px] border-b border-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-btn text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Menu className="size-5" />
            </button>
            <span className="text-sm font-bold text-foreground lg:hidden truncate max-w-[180px]">
              {tenantName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Locale switcher */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-btn border border-border">
              <button
                type="button"
                onClick={async () => {
                  setLocale("uz");
                  await setLocaleAction("uz");
                  router.refresh();
                }}
                className={`text-caption font-bold px-2 py-0.5 rounded-nav transition-colors cursor-pointer ${
                  locale === "uz" ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                UZ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLocale("ru");
                  await setLocaleAction("ru");
                  router.refresh();
                }}
                className={`text-caption font-bold px-2 py-0.5 rounded-nav transition-colors cursor-pointer ${
                  locale === "ru" ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                RU
              </button>
            </div>

            <ThemeToggle />

            {/* User profile & Role */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
              <div className="flex flex-col text-right">
                <span className="text-caption font-bold text-foreground">{user.name}</span>
                <span className="text-2xs text-muted-foreground">{user.phone}</span>
              </div>
              <Badge tone={roleTones[user.role] ?? "neutral"}>
                {roleLabels[user.role] ?? user.role}
              </Badge>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={async () => {
                await logoutAction();
                router.push("/login");
                router.refresh();
              }}
              title={t("action_logout", locale)}
              className="p-2 rounded-btn text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-[var(--topbar-bg)] backdrop-blur-[14px] border-t border-border flex items-center justify-around px-2">
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 text-2xs font-semibold transition-colors ${
              pathname === "/" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <LayoutDashboard className="size-5" />
            <span>{t("nav_home", locale)}</span>
          </Link>

          <Link
            href="/teraks"
            className={`flex flex-col items-center gap-1 text-2xs font-semibold transition-colors ${
              pathname.startsWith("/teraks") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <TreePine className="size-5" />
            <span>{t("nav_teraks", locale)}</span>
          </Link>

          {/* Center "+" Quick Action Button */}
          <button
            type="button"
            onClick={() => setQuickActionOpen(true)}
            className="size-11 -mt-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            aria-label={t("quick_actions", locale)}
          >
            <Plus className="size-6 stroke-[2.5]" />
          </button>

          <Link
            href="/work"
            className={`flex flex-col items-center gap-1 text-2xs font-semibold transition-colors ${
              pathname.startsWith("/work") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Briefcase className="size-5" />
            <span>{t("nav_work", locale)}</span>
          </Link>

          <Link
            href="/materials"
            className={`flex flex-col items-center gap-1 text-2xs font-semibold transition-colors ${
              pathname.startsWith("/materials") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Layers className="size-5" />
            <span>{t("nav_materials", locale)}</span>
          </Link>
        </nav>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-card border-r border-border flex flex-col p-4 shadow-modal animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <span className="font-bold text-sm text-foreground">{tenantName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-btn text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {filteredSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <h4 className="text-2xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                    {section.title}
                  </h4>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-nav text-caption font-semibold ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-caption font-bold text-foreground">{user.name}</span>
                <span className="text-2xs text-muted-foreground">{roleLabels[user.role]}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logoutAction();
                  router.push("/login");
                  router.refresh();
                }}
                className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Modal */}
      <QuickActionsModal
        isOpen={quickActionOpen}
        onClose={() => setQuickActionOpen(false)}
        locale={locale}
      />
    </div>
  );
}

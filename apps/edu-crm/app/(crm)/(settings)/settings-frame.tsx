"use client";

import {
  Bell,
  BookOpen,
  Building2,
  CalendarOff,
  DoorOpen,
  type LucideIcon,
  MessageSquareText,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@ventura/ui/lib/utils";
import { type SettingsGroup, type SettingsIcon } from "@/lib/settings-nav";
import { uz } from "@/lib/uz";

const ICONS: Record<SettingsIcon, LucideIcon> = {
  center: Building2,
  courses: BookOpen,
  rooms: DoorOpen,
  holidays: CalendarOff,
  payments: Wallet,
  notifications: Bell,
  sms: MessageSquareText,
  profile: UserRound,
  security: ShieldCheck,
};

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Sozlamalar ichki navbari (ADR 0051): katta ekranda chapda guruhlangan ro'yxat (qidiruv bilan), kichik ekranda
 * tepada gorizontal tasma. Sahifa o'ngda — o'z sarlavhasi bilan.
 */
export function SettingsFrame({ groups, children }: { groups: SettingsGroup[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const t = uz.settingsNav;
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLocaleLowerCase("uz");
  const shown = needle
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLocaleLowerCase("uz").includes(needle)) }))
        .filter((g) => g.items.length)
    : groups;
  const flat = groups.flatMap((g) => g.items);

  return (
    // Katta ekranda ikkala ustun ekran balandligida, har biri o'zi aylanadi: navbar joyidan qimirlamaydi va uning
    // ustida aylantirilganda yonidagi sahifa siljimaydi (topbar + main'ning yuqori/pastki ichki bo'shlig'i — 3rem)
    <div className="lg:grid lg:h-[calc(100dvh-var(--topbar-h)-3rem)] lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-6">
      {/* Kichik ekran: gorizontal tasma */}
      <nav aria-label={t.title} className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        <ul className="flex w-max gap-1.5">
          {flat.map((i) => {
            const Icon = ICONS[i.icon];
            const on = isActive(pathname, i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-control border px-3 text-body font-medium whitespace-nowrap transition-colors",
                    on
                      ? "border-(--ring-border) bg-primary-soft text-(--primary-text)"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Katta ekran: chap ustun */}
      <aside className="hidden min-h-0 lg:block">
        <div className="flex h-full flex-col gap-4 border-r border-border pr-6">
          <div>
            <h2 className="type-heading text-xl leading-tight text-foreground">{t.title}</h2>
            <p className="mt-1 text-body text-muted-foreground">{t.subtitle}</p>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-control border border-border bg-card px-3 focus-within:border-(--ring-border)">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
            />
          </label>
          <nav
            aria-label={t.title}
            className="relative -mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-2 pb-4"
          >
            {shown.map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 px-2.5 text-caption font-semibold text-muted-foreground">{g.title}</div>
                <ul className="space-y-0.5">
                  {g.items.map((i) => {
                    const Icon = ICONS[i.icon];
                    const on = isActive(pathname, i.href);
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "flex min-h-10 items-center gap-3 rounded-control px-2.5 text-body transition-colors",
                            on
                              ? "bg-primary-soft font-semibold text-(--primary-text)"
                              : "text-foreground hover:bg-accent",
                          )}
                        >
                          <Icon className={cn("size-[18px]", on ? "" : "text-muted-foreground")} aria-hidden />
                          {i.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!shown.length ? <p className="px-2.5 text-body text-muted-foreground">{t.empty}</p> : null}
          </nav>
        </div>
      </aside>

      {/* relative: Radix'ning yashirin forma inputlari (absolute) shu yerda qoladi, hujjatni uzaytirmaydi */}
      <div className="min-w-0 lg:relative lg:-mr-3 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-3 lg:pb-4">
        {children}
      </div>
    </div>
  );
}

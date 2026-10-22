"use client";

import {
  BookOpen,
  ChartColumn,
  GraduationCap,
  House,
  KeyRound,
  LogOut,
  type LucideIcon,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { cn } from "@ventura/ui/lib/utils";
import { type NavSection, Sidebar } from "@ventura/ui/sidebar";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { ProfileButton, Topbar } from "@ventura/ui/topbar";
import { KABINET_NAV, type KabinetIcon, kabinetActive } from "@/lib/kabinet-nav";
import { uz } from "@/lib/uz";
import { signOutAction } from "../../(auth)/actions";

const ICONS: Record<KabinetIcon, { icon: LucideIcon; hue: string }> = {
  home: { icon: House, hue: "blue" },
  groups: { icon: UsersRound, hue: "teal" },
  students: { icon: GraduationCap, hue: "sky" },
  homework: { icon: BookOpen, hue: "amber" },
  stats: { icon: ChartColumn, hue: "violet" },
  finance: { icon: Wallet, hue: "green" },
  profile: { icon: UserRound, hue: "slate" },
};

const SECTIONS: NavSection[] = [
  {
    title: uz.kabinet.navTitle,
    items: KABINET_NAV.map((i) => ({
      id: i.href,
      label: i.label,
      icon: ICONS[i.icon].icon,
      color: `var(--nav-hue-${ICONS[i.icon].hue})`,
    })),
  },
];

/**
 * Kabinet qobig'i: tepada CRM bilan bir xil panel, chapda o'z menyusi. Telefonda menyu pastki qatorda turadi
 * (o'qituvchi asosan telefondan davomat va baho qo'yadi).
 */
export function KabinetShell({
  staff,
  brand,
  children,
}: {
  staff: { name: string };
  brand: { name: string; mark?: React.ReactNode };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const active = kabinetActive(pathname);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  }

  return (
    <div className="min-h-dvh">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        brandName={brand.name}
        brandMark={brand.mark}
        brandSubtitle={uz.kabinet.subtitle}
      >
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ProfileButton name={staff.name} role={uz.kabinet.role} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="text-body font-bold text-foreground">{staff.name}</div>
              <div className="text-caption text-muted-foreground">{uz.kabinet.role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/kabinet/profil")}>
              <UserRound /> {uz.nav.profile}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/account/password")}>
              <KeyRound /> {uz.nav.password}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => void signOutAction().then(() => router.replace("/login"))}>
              <LogOut /> {uz.nav.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>

      <div className="flex">
        <Sidebar
          sections={SECTIONS}
          activeId={active}
          onSelect={(href) => {
            setMobileOpen(false);
            router.push(href);
          }}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 pb-24 sm:p-5 lg:p-6 min-[901px]:pb-6">
          {children}
        </main>
      </div>

      {/* Telefonda pastki menyu */}
      <nav
        aria-label={uz.kabinet.navTitle}
        className="fixed inset-x-0 bottom-0 z-(--z-topbar) flex border-t border-border bg-card/95 backdrop-blur min-[901px]:hidden"
      >
        {KABINET_NAV.map((i) => {
          const Icon = ICONS[i.icon].icon;
          const on = active === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs font-semibold [&_svg]:size-5",
                on ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

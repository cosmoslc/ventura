"use client";

import { BookOpen, House, LogOut, type LucideIcon, Settings, UsersRound } from "lucide-react";
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
import { PORTAL_NAV, type PortalIcon, portalActive } from "@/lib/portal-nav";
import { uz } from "@/lib/uz";
import { signOutAction } from "../../(auth)/actions";

const ICONS: Record<PortalIcon, { icon: LucideIcon; hue: string }> = {
  home: { icon: House, hue: "blue" },
  groups: { icon: UsersRound, hue: "teal" },
  homework: { icon: BookOpen, hue: "violet" },
  settings: { icon: Settings, hue: "slate" },
};

const SECTIONS: NavSection[] = [
  {
    title: uz.portal.oquvchiKabineti,
    items: PORTAL_NAV.map((i) => ({
      id: i.href,
      label: i.label,
      icon: ICONS[i.icon].icon,
      color: `var(--nav-hue-${ICONS[i.icon].hue})`,
    })),
  },
];

/**
 * O'quvchi portali qobig'i (ADR 0063).
 * Kompyuterda chapda, telefonda pastda qulay menyu.
 * Muallif / Agent: Google Gemini
 */
export function PortalShell({
  student,
  brand,
  children,
}: {
  student: { name: string };
  brand: { name: string; mark?: React.ReactNode };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const active = portalActive(pathname);

  function toggleSidebar() {
    if (window.matchMedia(uz.portal.maxWidth900px).matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  }

  return (
    <div className="min-h-dvh">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        brandName={brand.name}
        brandMark={brand.mark}
        brandSubtitle={uz.portal.portalName}
      >
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ProfileButton name={student.name} role="O'quvchi" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="text-body font-bold text-foreground">{student.name}</div>
              <div className="text-caption text-muted-foreground">O'quvchi</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/portal/sozlamalar")}>
              <Settings /> Sozlamalar
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
        aria-label={uz.portal.oquvchiKabineti}
        className="fixed inset-x-0 bottom-0 z-(--z-topbar) flex border-t border-border bg-card/95 backdrop-blur min-[901px]:hidden"
      >
        {PORTAL_NAV.map((i) => {
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

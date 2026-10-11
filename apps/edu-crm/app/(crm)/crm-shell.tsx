"use client";

import {
  BadgeDollarSign,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarOff,
  ChartColumn,
  Coins,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageSquareText,
  Receipt,
  Target,
  UserRoundX,
  Users,
  UsersRound,
  Wallet,
  FileCheck2,
  Blocks,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import type { NavGroup } from "@ventura/tenants";
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
import { uz } from "@/lib/uz";
import { signOutAction } from "../(auth)/actions";

/** Bo'lim kaliti → menyu ikonkasi va rangi (light rejim; dark'da --nav-icon-color). Manifestda yo'q bo'lsa — umumiy. */
const ICONS: Record<string, { icon: LucideIcon; hue: string }> = {
  students: { icon: GraduationCap, hue: "sky" },
  courses: { icon: BookOpen, hue: "orange" },
  teachers: { icon: Users, hue: "purple" },
  groups: { icon: UsersRound, hue: "orange" },
  branches: { icon: Building2, hue: "rose" },
  holidays: { icon: CalendarOff, hue: "pink" },
  attendance: { icon: CalendarCheck, hue: "emerald" },
  payments: { icon: Wallet, hue: "green" },
  debtors: { icon: UserRoundX, hue: "rose" },
  expenses: { icon: Receipt, hue: "amber" },
  salaries: { icon: BadgeDollarSign, hue: "teal" },
  exams: { icon: FileCheck2, hue: "violet" },
  coins: { icon: Coins, hue: "amber" },
  leads: { icon: Target, hue: "violet" },
  sms: { icon: MessageSquareText, hue: "sky" },
  reports: { icon: ChartColumn, hue: "blue" },
};
const FALLBACK = { icon: Blocks, hue: "slate" };

function sections(groups: NavGroup[]): NavSection[] {
  return [
    {
      title: uz.nav.main,
      items: [{ id: "/", label: uz.nav.home, icon: LayoutDashboard, color: "var(--nav-hue-blue)" }],
    },
    ...groups.map((g) => ({
      title: g.title,
      items: g.links.map((l) => {
        const { icon, hue } = ICONS[l.feature] ?? FALLBACK;
        return { id: l.href, label: l.label, icon, color: `var(--nav-hue-${hue})` };
      }),
    })),
  ];
}

/** Joriy manzilga eng uzun mos keladigan menyu bandi (band id — uning manzili). */
function activeFor(pathname: string, hrefs: string[]): string {
  let best = "/";
  for (const href of hrefs) {
    const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (match && href.length > best.length) best = href;
  }
  return best;
}

export function CrmShell({
  staff,
  brand,
  nav,
  children,
}: {
  staff: { name: string; roleLabel: string };
  brand: { name: string; mark?: React.ReactNode };
  nav: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navSections = React.useMemo(() => sections(nav), [nav]);
  const hrefs = React.useMemo(() => navSections.flatMap((s) => s.items.map((i) => i.id)), [navSections]);
  // Bosilgan band darhol aktiv ko'rinadi; sahifa serverdan kelguncha kontent xiralashadi (panel bilan bir xil)
  const [target, setTarget] = React.useState<{ id: string; from: string } | null>(null);
  const navigating = target !== null && target.from === pathname;
  const activeId = navigating ? target.id : activeFor(pathname, hrefs);

  React.useEffect(() => {
    if (!target) return;
    const timer = setTimeout(() => setTarget(null), 8000);
    return () => clearTimeout(timer);
  }, [target]);

  function go(href: string) {
    if (href === pathname) return;
    setTarget({ id: href, from: pathname });
    router.push(href);
  }

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
        brandSubtitle={uz.app.subtitle}
      >
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ProfileButton name={staff.name} role={staff.roleLabel} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="text-body font-bold text-foreground">{staff.name}</div>
              <div className="text-caption text-muted-foreground">{staff.roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => go("/account/password")}>
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
          sections={navSections}
          activeId={activeId}
          onSelect={(href) => {
            setMobileOpen(false);
            go(href);
          }}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main
          aria-busy={navigating || undefined}
          className={cn(
            "min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 transition-opacity duration-200 sm:p-6 lg:p-8",
            navigating && "opacity-50 delay-150",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Bosh sahifadagi bo'lim kartochkalari uchun ham shu ikonkalar. */
export function FeatureIcon({ feature, className }: { feature: string; className?: string }) {
  const { icon: Icon, hue } = ICONS[feature] ?? FALLBACK;
  return <Icon className={className} style={{ color: `var(--nav-hue-${hue})` }} />;
}

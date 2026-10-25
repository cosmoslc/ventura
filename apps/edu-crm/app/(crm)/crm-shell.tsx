"use client";

import {
  Archive,
  BadgeDollarSign,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarOff,
  IdCard,
  ShieldCheck,
  ChartColumn,
  Coins,
  GraduationCap,
  KeyRound,
  ClipboardCheck,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  type LucideIcon,
  MessageSquareText,
  Receipt,
  ScrollText,
  Settings,
  Target,
  UserCheck,
  UserRound,
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
import { type NavChild, type NavItem, type NavSection, Sidebar } from "@ventura/ui/sidebar";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { ProfileButton, Topbar } from "@ventura/ui/topbar";
import { isSettingsPath } from "@/lib/settings-nav";
import { uz } from "@/lib/uz";
import { signOutAction } from "../(auth)/actions";
import { BranchPicker, type PickerBranch } from "./branch-picker";
import { NotificationBell } from "./(settings)/notifications/notification-bell";
import { type QuickAction, SearchPalette } from "./search/search-palette";

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
/** Menyu manzili → ikonka (bitta bo'limning bir nechta bandi bo'lsa, masalan Xonalar — guruhlar bo'limida) */
const HREF_ICONS: Record<string, { icon: LucideIcon; hue: string }> = {
  "/bugun": { icon: ListChecks, hue: "amber" },
  "/positions": { icon: ShieldCheck, hue: "violet" },
  "/staff": { icon: IdCard, hue: "sky" },
  "/staff-attendance": { icon: UserCheck, hue: "teal" },
  "/money-audit": { icon: History, hue: "violet" },
  "/archive": { icon: Archive, hue: "slate" },
  "/activity": { icon: ScrollText, hue: "blue" },
};

/** Bo'lim ichidagi tartib: ro'yxatda yo'qlari oxirida, manifest tartibida */
const ITEM_ORDER = [
  // O'quv jarayoni
  "/students",
  "/groups",
  "/exams",
  "/leads",
  "/coins",
  "/attendance",
  // Moliya
  "/payments",
  "/debtors",
  "/expenses",
  "/additional-income",
  "/money-audit",
  // Tahlil
  "/reports",
  "/sms",
  // Jamoa
  "/staff",
  "/positions",
  "/salaries",
  "/teachers",
  "/staff-attendance",
  // Tizim ("Sozlamalar" bandi bo'lim boshida)
  "/branches",
  "/archive",
  "/activity",
  "/reasons",
];
const itemRank = (href: string) => {
  const i = ITEM_ORDER.indexOf(href);
  return i === -1 ? ITEM_ORDER.length : i;
};

/** Menyu bo'limlari tartibi; "Asos" bandlari bosh sahifa bilan birga eng tepada. */
const SECTION_ORDER = ["Asos", "O'quv jarayoni", "Moliya", "Tahlil", "Jamoa", "Tizim"];
const MAIN = "Asos";
const SETTINGS_SECTION = "Tizim";

function sections(
  groups: NavGroup[],
  approvals: { label: string; count: number } | null,
  reportMenu: NavChild[],
  settingsHref: string | null,
): NavSection[] {
  const toItems = (g: NavGroup): NavItem[] =>
    [...g.links]
      .sort((a, b) => itemRank(a.href) - itemRank(b.href))
      .map((l) => {
        const { icon, hue } = HREF_ICONS[l.href] ?? ICONS[l.feature] ?? FALLBACK;
        const item = { id: l.href, label: l.label, icon, color: `var(--nav-hue-${hue})` };
        // Hisobotlar — ichma-ich menyu; band o'zi ochiladigan sarlavha, ichki hisobotlar to'g'ridan-to'g'ri ko'rsatiladi
        if (l.href === "/reports" && reportMenu.length)
          return {
            ...item,
            id: "menu:/reports",
            children: reportMenu,
          };
        return item;
      });
  const rank = (title: string) => {
    const i = SECTION_ORDER.indexOf(title);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  const main = groups.find((g) => g.title === MAIN);
  // "Sozlamalar" — Tizim bo'limining boshida (ichida o'z navbari, ADR 0051)
  const settings: NavItem | null = settingsHref
    ? { id: settingsHref, label: uz.nav.settings, icon: Settings, color: "var(--nav-hue-blue)" }
    : null;
  const rest = groups
    .filter((g) => g.title !== MAIN)
    .sort((a, b) => rank(a.title) - rank(b.title))
    .map((g) => ({ title: g.title, items: toItems(g) }));
  if (settings) {
    const office = rest.find((s) => s.title === SETTINGS_SECTION);
    if (office) office.items.unshift(settings);
    else rest.push({ title: SETTINGS_SECTION, items: [settings] });
  }
  return [
    {
      title: uz.nav.main,
      items: [
        { id: "/", label: uz.nav.home, icon: LayoutDashboard, color: "var(--nav-hue-blue)" },
        ...(approvals
          ? [
              {
                id: "/approvals",
                label: approvals.label,
                icon: ClipboardCheck,
                color: "var(--nav-hue-amber)",
                count: approvals.count || undefined,
              },
            ]
          : []),
        ...(main ? toItems(main) : []),
      ],
    },
    ...rest,
  ];
}

/** Sahifa bandlari (manzillar): ost menyusi bor band va guruhlar sahifa emas */
const leaves = (n: { id: string; children?: NavChild[] }): string[] =>
  n.children?.length ? n.children.flatMap(leaves) : [n.id];

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
  approvals,
  reportMenu,
  settingsHref,
  branches,
  unreadNotifications,
  quickActions,
  children,
}: {
  staff: { name: string; roleLabel: string };
  brand: { name: string; mark?: React.ReactNode };
  nav: NavGroup[];
  /** "Tasdiqlar" (direktor) yoki "So'rovlarim" (tasdiq bilan ruxsati bor xodim), kutilayotganlar soni bilan */
  approvals: { label: string; count: number } | null;
  /** Hisobotlar ichki menyusi: guruh → xodimga ochiq hisobotlar */
  reportMenu: NavChild[];
  /** "Sozlamalar" bandi manzili: xodim ochishi mumkin bo'lgan birinchi sozlama; null — band yo'q */
  settingsHref: string | null;
  /** Filial tanlovi: ko'p filialli rejimda va xodimga bittadan ortiq filial ochiq bo'lsa */
  branches: { options: PickerBranch[]; selected: string } | null;
  /** Qo'ng'iroqdagi o'qilmagan bildirishnomalar soni (E6d) */
  unreadNotifications: number;
  /** Qidiruv oynasidagi tezkor amallar: xodimga ruxsat etilganlari (E6h) */
  quickActions: QuickAction[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const navSections = React.useMemo(
    () => sections(nav, approvals, reportMenu, settingsHref),
    [nav, approvals, reportMenu, settingsHref],
  );
  const hrefs = React.useMemo(() => navSections.flatMap((s) => s.items.flatMap(leaves)), [navSections]);
  // Bosilgan band darhol aktiv ko'rinadi; sahifa serverdan kelguncha kontent xiralashadi (panel bilan bir xil)
  const [target, setTarget] = React.useState<{ id: string; from: string } | null>(null);
  const navigating = target !== null && target.from === pathname;
  // Sozlamalar ichidagi istalgan sahifada "Sozlamalar" bandi faol
  const activeId = navigating
    ? target.id
    : settingsHref && isSettingsPath(pathname)
      ? settingsHref
      : activeFor(pathname, hrefs);

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
        searchPlaceholder={uz.search.open}
        onSearchOpen={() => setSearchOpen(true)}
        leading={branches ? <BranchPicker options={branches.options} selected={branches.selected} /> : null}
      >
        <NotificationBell initial={unreadNotifications} />
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
            <DropdownMenuItem onSelect={() => go("/account")}>
              <UserRound /> {uz.nav.profile}
            </DropdownMenuItem>
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
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} quick={quickActions} />

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
            "min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 transition-opacity duration-200 sm:p-5 lg:p-6",
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
export function FeatureIcon({ feature, href, className }: { feature: string; href?: string; className?: string }) {
  const { icon: Icon, hue } = (href && HREF_ICONS[href]) || ICONS[feature] || FALLBACK;
  return <Icon className={className} style={{ color: `var(--nav-hue-${hue})` }} />;
}

"use client";

import { Activity, Blocks, FolderKanban, KeyRound, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import type { Role } from "@ventura/db/schema/panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { type NavChild, type NavSection, Sidebar } from "@ventura/ui/sidebar";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { ProfileButton, Topbar } from "@ventura/ui/topbar";
import { uz } from "@/lib/uz";
import { signOutAction } from "../(auth)/actions";

/** Menyu bandi id → manzil. 1-bosqichda faqat tayyor sahifalar. */
const HREF: Record<string, string> = {
  home: "/",
  "projects-all": "/projects",
  "projects-new": "/projects/new",
  "projects-trash": "/projects/trash",
  clients: "/clients",
  templates: "/templates",
  audit: "/audit",
  "settings-security": "/settings/security",
  "settings-admins": "/settings/admins",
};

function sections(role: Role): NavSection[] {
  const settingsChildren: NavChild[] = [{ id: "settings-security", label: uz.nav.security }];
  if (role === "super_admin") settingsChildren.push({ id: "settings-admins", label: uz.nav.admins });
  const projectChildren: NavChild[] = [{ id: "projects-all", label: uz.nav.projectsAll }];
  if (role !== "viewer") projectChildren.push({ id: "projects-new", label: uz.nav.projectsNew });
  projectChildren.push({ id: "projects-trash", label: uz.nav.projectsTrash });
  return [
    {
      title: uz.nav.main,
      items: [
        { id: "home", label: uz.nav.home, icon: LayoutDashboard, color: "#006aff" },
        { id: "projects", label: uz.nav.projects, icon: FolderKanban, color: "#8b5cf6", children: projectChildren },
        { id: "clients", label: uz.nav.clients, icon: Users, color: "#f59e0b" },
        { id: "templates", label: uz.nav.templates, icon: Blocks, color: "#27ae60" },
      ],
    },
    {
      title: uz.nav.control,
      items: [{ id: "audit", label: uz.nav.audit, icon: Activity, color: "#ec4899" }],
    },
    {
      title: uz.nav.system,
      items: [{ id: "settings", label: uz.nav.settings, icon: Settings, color: "#64748b", children: settingsChildren }],
    },
  ];
}

/** Joriy manzilga eng uzun mos keladigan menyu bandi. */
function activeFor(pathname: string): string {
  let best = "home";
  let bestLen = 0;
  for (const [id, href] of Object.entries(HREF)) {
    const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (match && href.length > bestLen) {
      best = id;
      bestLen = href.length;
    }
  }
  return best; // /projects/<id> → "Barcha loyihalar" (eng uzun mos prefiks)
}

export function PanelShell({
  viewer,
  children,
}: {
  viewer: { name: string; role: Role; roleLabel: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const nav = React.useMemo(() => sections(viewer.role), [viewer.role]);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  }

  return (
    <div className="min-h-dvh">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        brandSubtitle={uz.app.subtitle}
        searchPlaceholder={uz.common.search}
      >
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ProfileButton name={viewer.name} role={viewer.roleLabel} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="text-body font-bold text-foreground">{viewer.name}</div>
              <div className="text-caption text-muted-foreground">{viewer.roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/account/password")}>
              <KeyRound /> {uz.nav.profile}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => void signOutAction()}>
              <LogOut /> {uz.nav.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>

      <div className="flex">
        <Sidebar
          sections={nav}
          activeId={activeFor(pathname)}
          onSelect={(id) => {
            setMobileOpen(false);
            const href = HREF[id];
            if (href) router.push(href);
          }}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

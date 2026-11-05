"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  ExternalLink,
  LayoutDashboard,
  Monitor,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Sidebar, type NavSection } from "@ventura/ui/sidebar";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { Topbar } from "@ventura/ui/topbar";
import { useStore } from "@/lib/store-context";

interface AdminShellProps {
  children: React.ReactNode;
}

const NAV: NavSection[] = [
  {
    title: "Boshqaruv",
    items: [
      { id: "/admin", label: "Boshqaruv paneli", icon: LayoutDashboard, color: "var(--nav-hue-blue)" },
      { id: "/admin/products", label: "Mahsulotlar", icon: Boxes, color: "var(--nav-hue-violet)" },
      { id: "/admin/purchases", label: "Kirimlar (Ombor)", icon: PackagePlus, color: "var(--nav-hue-green)" },
      { id: "/admin/sales", label: "Sotuvlar & Foyda", icon: Receipt, color: "var(--nav-hue-amber)" },
      { id: "/admin/pcs", label: "PClar (Tayyor)", icon: Monitor, color: "var(--nav-hue-sky)" },
      { id: "/admin/pc-orders", label: "PC Zakazlar", icon: Wrench, color: "var(--nav-hue-teal)" },
      { id: "/admin/orders", label: "Buyurtmalar", icon: ShoppingCart, color: "var(--nav-hue-pink)" },
      { id: "/admin/users", label: "Foydalanuvchilar", icon: Users, color: "var(--nav-hue-orange)" },
    ],
  },
  {
    title: "Tizim",
    items: [{ id: "/admin/settings", label: "Sozlamalar", icon: Settings, color: "var(--nav-hue-slate)" }],
  },
];

function activeFor(pathname: string) {
  let activeId = "/admin";
  let bestLength = 0;
  for (const section of NAV) {
    for (const item of section.items) {
      const matches = item.id === "/admin"
        ? pathname === item.id
        : pathname === item.id || pathname.startsWith(`${item.id}/`);
      if (matches && item.id.length > bestLength) {
        activeId = item.id;
        bestLength = item.id.length;
      }
    }
  }
  return activeId;
}

export function AdminShell({ children }: AdminShellProps) {
  const { branding } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeId = useMemo(() => activeFor(pathname), [pathname]);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((open) => !open);
    else setCollapsed((value) => !value);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        brandName={branding.name || "VENTURA PC"}
        brandMark={<Monitor className="size-5" />}
        brandSubtitle="Boshqaruv paneli"
      >
        <ThemeToggle />
        <Link href="/" target="_blank" rel="noreferrer" className="hidden sm:inline-flex">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
            <ExternalLink size={14} />
            Doʻkon
          </Button>
        </Link>
      </Topbar>

      <div className="flex min-h-[calc(100dvh-var(--topbar-h))]">
        <Sidebar
          sections={NAV}
          activeId={activeId}
          onSelect={(href) => {
            setMobileOpen(false);
            if (href !== pathname) router.push(href);
          }}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          footer={
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-(--nav-fg) transition-colors hover:bg-(--nav-hover-bg) hover:text-(--nav-hover-fg)"
            >
              <ExternalLink className="size-4 shrink-0" />
              <span>Doʻkonga oʻtish</span>
            </Link>
          }
        />
        <main className="min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

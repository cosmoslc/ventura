"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  LogOut,
  Package,
  Settings,
  User,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { useSession, signOut } from "@/lib/auth-client";

const PROFILE_NAV = [
  { label: "Umumiy koʻrinish", href: "/profile", icon: User },
  { label: "Mening buyurtmalarim", href: "/profile/orders", icon: Package },
  { label: "Saralanganlar (Liked)", href: "/profile/liked", icon: Heart },
  { label: "Profil sozlamalari", href: "/profile/settings", icon: Settings },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const user = session?.user;
  const displayName = user?.name || (isPending ? "" : "Mijoz");
  const displayEmailOrPhone = user?.email || (isPending ? "" : "Profil hisobi");
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Chap tomon: Profil Menyusi */}
            <aside className="lg:col-span-3 space-y-4">
              <div className="rounded-card border border-border bg-card p-5">
                {/* Foydalanuvchi mini kartasi */}
                {isPending ? (
                  <div className="flex items-center gap-3 pb-4 border-b border-border animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-28 bg-muted rounded" />
                      <div className="h-3 w-36 bg-muted rounded" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-lg overflow-hidden border border-primary/20">
                      {user?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.image}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                      {user && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-(--success-fg) ring-2 ring-card" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-foreground truncate">
                        {displayName}
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground block truncate">
                        {displayEmailOrPhone}
                      </span>
                    </div>
                  </div>
                )}

                {/* Navigatsiya havolalari */}
                <nav className="mt-4 space-y-1">
                  {PROFILE_NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-btn px-3 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-control"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-btn px-3 py-2.5 text-xs sm:text-sm font-semibold text-(--danger-fg) hover:bg-(--danger-bg) transition-colors mt-2 text-left cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Chiqish</span>
                  </button>
                </nav>
              </div>
            </aside>

            {/* O'ng tomon: Asosiy profil sahifasi */}
            <div className="lg:col-span-9">
              {children}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

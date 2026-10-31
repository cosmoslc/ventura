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
  const { data: session } = useSession();

  const user = session?.user;
  const displayName = user?.name || "Sardorbek Rahimov";
  const displayEmailOrPhone = user?.email || "+998 90 123 45 67";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Chap tomon: Profil Menyusi */}
            <aside className="lg:col-span-3 space-y-4">
              <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
                {/* Foydalanuvchi mini kartasi */}
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
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
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

                {/* Navigatsiya havolalari */}
                <nav className="mt-4 space-y-1">
                  {PROFILE_NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-[var(--r-btn,8px)] px-3 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs"
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
                    className="w-full flex items-center gap-3 rounded-[var(--r-btn,8px)] px-3 py-2.5 text-xs sm:text-sm font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors mt-2 text-left cursor-pointer"
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

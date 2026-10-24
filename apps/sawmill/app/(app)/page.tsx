import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Layers,
  TreePine,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ventura/ui/card";
import { t } from "@/lib/i18n";
import { requireUser } from "@/lib/server/session";

export default async function DashboardPage() {
  const { user, tenant } = await requireUser();
  const locale = user.locale ?? "uz";

  const cards = [
    {
      title: t("nav_teraks", locale),
      desc: "Yog'och partiyalari xaridi va holati",
      href: "/teraks",
      icon: TreePine,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: t("nav_work", locale),
      desc: "Kunlik ishlar, sartirofka va hisoblar",
      href: "/work",
      icon: Briefcase,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: t("nav_stock", locale),
      desc: "Materiallar qoldig'i va o'lchamlar",
      href: "/materials",
      icon: Layers,
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: t("nav_dispatch", locale),
      desc: "Xaridorlarga sotuv va jo'natish",
      href: "/dispatch",
      icon: Truck,
      color: "text-indigo-500 bg-indigo-500/10",
    },
    {
      title: t("nav_workers", locale),
      desc: "Ishchilar ro'yxati va oylik hisob-kitob",
      href: "/workers",
      icon: Users,
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      title: t("nav_reports", locale),
      desc: "Foyda tahlili va davriy hisobotlar",
      href: "/reports",
      icon: BarChart3,
      color: "text-rose-500 bg-rose-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="rounded-3xl bg-gradient-to-r from-[var(--primary)] to-emerald-700 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <Badge tone="neutral" className="bg-white/20 text-white border-none mb-3 backdrop-blur-xs">
            v0.1.0 • S0 Skelet
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {tenant.name}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/90 leading-relaxed">
            {t("home_welcome_desc", locale)}
          </p>
        </div>
      </div>

      {/* Feature Navigation Grid */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">
          {t("nav_group_main", locale)}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.href} href={c.href} className="group">
                <Card className="h-full border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:shadow-md transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)]">
                      {c.title}
                    </CardTitle>
                    <div className={`size-9 rounded-xl flex items-center justify-center ${c.color}`}>
                      <Icon className="size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-1">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {c.desc}
                    </p>
                    <div className="mt-3 flex items-center text-xs font-semibold text-[var(--primary)] gap-1">
                      <span>Ochish</span>
                      <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

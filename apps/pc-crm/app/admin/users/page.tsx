"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Unlock,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { formatMoney } from "@/lib/format";

interface AdminUserItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  provider: "phone" | "google";
  ordersCount: number;
  totalSpent: bigint;
  registeredAt: string;
  lastLoginAt: string;
  status: "active" | "blocked";
}

const INITIAL_USERS: AdminUserItem[] = [
  {
    id: "usr-1",
    name: "Sardorbek Rahimov",
    phone: "+998 90 123 45 67",
    email: "sardor@example.com",
    provider: "phone",
    ordersCount: 4,
    totalSpent: 28_950_000n,
    registeredAt: "2026-08-12",
    lastLoginAt: "2026-10-29 14:15",
    status: "active",
  },
  {
    id: "usr-2",
    name: "Azizbek Yusupov",
    phone: "+998 97 765 43 21",
    email: "azizbek.dev@gmail.com",
    provider: "google",
    ordersCount: 2,
    totalSpent: 16_200_000n,
    registeredAt: "2026-09-01",
    lastLoginAt: "2026-10-28 18:20",
    status: "active",
  },
  {
    id: "usr-3",
    name: "Doston Qodirov",
    phone: "+998 93 333 44 55",
    email: "doston.q@yandex.ru",
    provider: "phone",
    ordersCount: 1,
    totalSpent: 48_000_000n,
    registeredAt: "2026-10-20",
    lastLoginAt: "2026-10-27 10:12",
    status: "active",
  },
  {
    id: "usr-4",
    name: "Botir Ergashev",
    phone: "+998 91 999 88 77",
    provider: "phone",
    ordersCount: 0,
    totalSpent: 0n,
    registeredAt: "2026-10-25",
    lastLoginAt: "2026-10-25 11:00",
    status: "active",
  },
  {
    id: "usr-5",
    name: "Spam / Shubhali Profil",
    phone: "+998 95 000 00 00",
    provider: "phone",
    ordersCount: 0,
    totalSpent: 0n,
    registeredAt: "2026-10-26",
    lastLoginAt: "2026-10-26 03:12",
    status: "blocked",
  },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.phone.includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [users, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === "active").length;
    const payingUsers = users.filter((u) => u.ordersCount > 0).length;
    const totalSpentAll = users.reduce((sum, u) => sum + u.totalSpent, 0n);

    return {
      totalUsers,
      activeUsers,
      payingUsers,
      totalSpentAll,
    };
  }, [users]);

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "active" ? "blocked" : "active" }
          : u
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Foydalanuvchilar boshqaruvi</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Saytda roʻyxatdan oʻtgan mijozlar, ularning xarid tarixi va xavfsizlik holati
          </p>
        </div>
      </div>

      {/* 4 ta Statistik karta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Jami foydalanuvchilar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.totalUsers} ta</span>
            <Users size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Roʻyxatdan oʻtgan profil
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Faol mijozlar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.activeUsers} ta</span>
            <UserCheck size={20} className="text-emerald-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Bloklanmagan profillar
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Xaridorlar soni
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.payingUsers} ta</span>
            <ShoppingBag size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Kamida 1 ta buyurtma bergan
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Jami xaridlar summasi
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-black font-mono text-foreground truncate">
              {formatMoney(stats.totalSpentAll)}
            </span>
            <ShieldCheck size={20} className="text-emerald-500 shrink-0 ml-1" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Barcha mijozlar boʻyicha
          </span>
        </div>
      </div>

      {/* Filterlar qatori */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Qidiruv */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ism, telefon raqam yoki email..."
            className="w-full rounded-[var(--r-input,8px)] border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat tablari */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              { label: "Barchasi", value: "all" },
              { label: "Faollar", value: "active" },
              { label: "Bloklanganlar", value: "blocked" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatusFilter(t.value)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Foydalanuvchilar jadvali */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Foydalanuvchi</th>
                <th className="py-3 px-4">Kirish usuli</th>
                <th className="py-3 px-4 text-center">Buyurtmalar</th>
                <th className="py-3 px-4 text-right">Jami xarid</th>
                <th className="py-3 px-4">Roʻyxatdan oʻtgan</th>
                <th className="py-3 px-4">Oxirgi kirish</th>
                <th className="py-3 px-4 text-center">Holat</th>
                <th className="py-3 px-4 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    Foydalanuvchi topilmadi.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    {/* Foydalanuvchi ismi va tel */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">{user.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground block">
                            {user.phone}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kirish usuli */}
                    <td className="py-3.5 px-4">
                      <Badge tone={user.provider === "google" ? "info" : "neutral"} className="gap-1 text-[11px]">
                        {user.provider === "google" ? "Google" : "SMS Telefon"}
                      </Badge>
                    </td>

                    {/* Buyurtmalar soni */}
                    <td className="py-3.5 px-4 text-center font-bold font-mono">
                      {user.ordersCount} ta
                    </td>

                    {/* Jami xarid */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                      {formatMoney(user.totalSpent)}
                    </td>

                    {/* Sana */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                      {user.registeredAt}
                    </td>

                    {/* Oxirgi kirish */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                      {user.lastLoginAt}
                    </td>

                    {/* Holat */}
                    <td className="py-3.5 px-4 text-center">
                      <Badge tone={user.status === "active" ? "success" : "danger"}>
                        {user.status === "active" ? "Faol" : "Bloklangan"}
                      </Badge>
                    </td>

                    {/* Bloklash / Tiklash */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(user.id)}
                        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                          user.status === "active"
                            ? "text-rose-500 hover:bg-rose-500/10"
                            : "text-emerald-500 hover:bg-emerald-500/10"
                        }`}
                      >
                        {user.status === "active" ? (
                          <>
                            <Ban size={13} />
                            Bloklash
                          </>
                        ) : (
                          <>
                            <Unlock size={13} />
                            Tiklash
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

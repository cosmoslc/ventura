"use client";
import { Input } from "@ventura/ui/input";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Search,
  ShieldCheck,
  ShoppingBag,
  Unlock,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { StatCard } from "@ventura/ui/stat-card";
import { formatMoney } from "@/lib/format";
import { getAdminUsersAction, toggleUserActiveAction } from "@/lib/server/actions";

interface AdminUserItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  provider: "email" | "google";
  ordersCount: number;
  totalSpent: bigint;
  registeredAt: string;
  lastLoginAt: string;
  status: "active" | "blocked";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    const result = await getAdminUsersAction();
    if (!result.success) { setError(result.error ?? "Foydalanuvchilarni yuklab bo'lmadi"); return; }
    setError("");
    setUsers(result.users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone ?? "—",
      email: u.email,
      provider: u.provider,
      ordersCount: u.ordersCount,
      totalSpent: u.totalSpent,
      registeredAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? "—",
      status: u.isActive ? "active" : "blocked",
    })));
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);
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

  const toggleUserStatus = async (id: string) => {
    const result = await toggleUserActiveAction(id);
    if (!result.success) { setError(result.error ?? "Foydalanuvchi holatini o'zgartirib bo'lmadi"); return; }
    await loadUsers();
  };

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)">{error}</div>}

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} label="Jami foydalanuvchilar" value={`${stats.totalUsers} ta`} tone={1} />
        <StatCard icon={<UserCheck />} label="Faol mijozlar" value={`${stats.activeUsers} ta`} tone={2} />
        <StatCard icon={<ShoppingBag />} label="Xaridorlar soni" value={`${stats.payingUsers} ta`} tone={3} />
        <StatCard icon={<ShieldCheck />} label="Jami xaridlar summasi" value={formatMoney(stats.totalSpentAll)} tone={4} valueClassName="whitespace-nowrap text-title" />
      </div>

      {/* Filterlar qatori */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Qidiruv */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ism, telefon raqam yoki email..."
            className="w-full rounded-control border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat tablari */}
        <div className="flex items-center gap-1 rounded-control border border-border bg-card p-1">
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
              className={`rounded-control px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-control"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Foydalanuvchilar jadvali */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-control">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-caption font-bold uppercase tracking-wider text-muted-foreground">
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
                          <span className="font-mono text-caption text-muted-foreground block">
                            {user.phone}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kirish usuli */}
                    <td className="py-3.5 px-4">
                      <Badge tone={user.provider === "google" ? "info" : "neutral"} className="gap-1 text-caption">
                        {user.provider === "google" ? "Google" : "Email / parol"}
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
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-caption">
                      {user.registeredAt}
                    </td>

                    {/* Oxirgi kirish */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-caption">
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
                            ? "text-(--danger-fg) hover:bg-(--danger-bg)"
                            : "text-(--success-fg) hover:bg-(--success-bg)"
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

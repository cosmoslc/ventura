"use client";

import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  GraduationCap,
  Sparkles,
  User,
  UsersRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { StatCard } from "@ventura/ui/stat-card";
import { money } from "@/lib/format";
import type { PortalDashboard } from "@/lib/server/portal";

/**
 * O'quvchi portali bosh sahifasi (ADR 0063).
 * Balans, reyting, davomat, baholar statistikasi va bugungi darslar.
 * Muallif / Agent: Google Gemini
 */
export function PortalDashboardView({ data }: { data: PortalDashboard }) {
  const { student, balance, coins, rank, attendance, grades, todayLessons } = data;

  const isDebtor = balance < 0;

  return (
    <div className="space-y-6">
      {/* Salomlashuv */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-title text-foreground">Salom, {student.name}! 👋</h1>
          <p className="text-body text-muted-foreground">O'quv ko'rsatkichlaringiz va bugungi darslaringiz</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info" className="px-3 py-1 text-caption font-semibold">
            <Sparkles className="mr-1 size-3.5" /> Markazda {rank.current}-o'rin
          </Badge>
        </div>
      </div>

      {/* Asosiy 4 ta karta */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Balans */}
        <StatCard
          tone={balance > 0 ? 2 : balance < 0 ? 3 : 1}
          icon={<Wallet />}
          label="Mening balansim"
          value={balance === 0 ? "0 so'm" : `${balance > 0 ? "+" : ""}${money(balance)}`}
          hint={
            isDebtor
              ? "To'lov muddati yaqinlashmoqda"
              : balance > 0
                ? "Oldindan to'lov qilingan"
                : "Hisob to'liq yopilgan"
          }
        />

        {/* Coinlar va Reyting */}
        <StatCard
          tone={4}
          icon={<Coins />}
          label="Mening coinlarim"
          value={`${money(coins)} coin`}
          hint={`Jami ${rank.total} o'quvchi orasida ${rank.current}-o'rin`}
        />

        {/* Davomat */}
        <StatCard
          tone={2}
          icon={<CheckCircle2 />}
          label="Dars davomati"
          value={attendance.percent !== null ? `${attendance.percent}%` : "—"}
          hint={`${attendance.present} ta darsga kelgan, ${attendance.absent} ta qoldirilgan`}
        />

        {/* O'zlashtirish */}
        <StatCard
          tone={1}
          icon={<GraduationCap />}
          label="O'rtacha o'zlashtirish"
          value={grades.averagePercent !== null ? `${grades.averagePercent}%` : "—"}
          hint={`Uy vazifalari: ${grades.homeworkPercent !== null ? `${grades.homeworkPercent}%` : "—"}`}
        />
      </div>

      {/* Bugungi darslar bloki */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="type-heading text-subheading text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-primary" /> Bugungi darslar
          </h2>
          <Link href="/portal/guruhlar" className="text-caption font-semibold text-primary hover:underline flex items-center gap-1">
            Barcha guruhlar <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {todayLessons.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {todayLessons.map((l) => (
              <Card key={l.groupId} className="p-4 space-y-3 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-body font-bold text-foreground">{l.groupName}</h3>
                    <p className="text-caption text-muted-foreground">{l.courseName}</p>
                  </div>
                  <Badge tone="info" className="font-mono text-2xs">
                    {l.roomName}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border-soft text-caption text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-mono text-foreground font-semibold">
                    <Clock className="size-3.5 text-primary" /> {l.startTime} — {l.endTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="size-3.5" /> {l.teacherName}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center space-y-2 border-dashed">
            <Calendar className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-body font-semibold text-foreground">Bugun rejalashtirilgan darslar yo'q</p>
            <p className="text-caption text-muted-foreground">Dam oling yoki uy vazifalarini takrorlang!</p>
          </Card>
        )}
      </div>

      {/* Tezkor havolalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/portal/guruhlar">
          <Card className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-primary-soft text-primary grid place-items-center">
                <UsersRound className="size-5" />
              </div>
              <div>
                <h4 className="text-body font-bold text-foreground group-hover:text-primary transition-colors">
                  Mening guruhlarim
                </h4>
                <p className="text-caption text-muted-foreground">Dars jadvali, baholar va davomat</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Card>
        </Link>

        <Link href="/portal/uy-ishi">
          <Card className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-(--violet-soft,var(--primary-soft)) text-violet-600 grid place-items-center">
                <BookOpen className="size-5" />
              </div>
              <div>
                <h4 className="text-body font-bold text-foreground group-hover:text-violet-600 transition-colors">
                  Uy vazifalari
                </h4>
                <p className="text-caption text-muted-foreground">O'qituvchi bergan topshiriqlar ro'yxati</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
          </Card>
        </Link>
      </div>
    </div>
  );
}

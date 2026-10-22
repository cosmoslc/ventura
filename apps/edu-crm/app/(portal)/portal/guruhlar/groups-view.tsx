"use client";

import { ArrowRight, Clock, MapPin, User, UsersRound } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import type { PortalGroupItem } from "@/lib/server/portal";

const DAY_LABELS: Record<string, string> = {
  mon: "Du",
  tue: "Se",
  wed: "Cho",
  thu: "Pa",
  fri: "Ju",
  sat: "Sha",
  sun: "Ya",
};

/**
 * O'quvchi guruhlari ro'yxati (ADR 0063).
 * Soati, xonasi, dars kunlari va o'qituvchisi.
 * Muallif / Agent: Google Gemini
 */
export function PortalGroupsView({ groups }: { groups: PortalGroupItem[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-heading text-title text-foreground">Mening guruhlarim</h1>
        <p className="text-body text-muted-foreground">Siz qatnashayotgan barcha faol guruhlar va dars jadvallari</p>
      </div>

      {groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const daysText = g.days.map((d) => DAY_LABELS[d] ?? d).join(", ");
            return (
              <Link key={g.id} href={`/portal/guruhlar/${g.id}`}>
                <Card className="p-5 space-y-4 hover:border-primary/60 transition-all cursor-pointer group h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-subheading font-bold text-foreground group-hover:text-primary transition-colors">
                          {g.name}
                        </h2>
                        <p className="text-caption text-muted-foreground">{g.courseName}</p>
                      </div>
                      <Badge tone={g.membershipStatus === "active" ? "success" : "neutral"} className="shrink-0">
                        {g.membershipStatus === "active" ? "Faol" : g.membershipStatus}
                      </Badge>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border-soft text-caption text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-primary shrink-0" />
                        <span className="font-mono text-foreground font-semibold">
                          {g.startTime} — {g.endTime}
                        </span>
                        {daysText ? <span className="text-muted-foreground">({daysText})</span> : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary shrink-0" />
                        <span className="text-foreground">{g.roomName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="size-4 text-primary shrink-0" />
                        <span className="text-foreground">{g.teacherName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border-soft flex items-center justify-between text-caption font-semibold text-primary">
                    <span>Guruh tafsilotlari</span>
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <UsersRound className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-body font-bold text-foreground">Siz hali birorta guruhga qo'shilmagansiz</h3>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Guruhga qo'shilish uchun o'quv markazingiz ma'muriyatiga yoki o'qituvchingizga murojaat qiling.
          </p>
        </Card>
      )}
    </div>
  );
}

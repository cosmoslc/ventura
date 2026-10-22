"use client";

import { ArrowRight, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import type { PortalGroupItem } from "@/lib/server/portal";

export const PORTAL_DAY_LABELS: Record<string, string> = {
  mon: "Du",
  tue: "Se",
  wed: "Cho",
  thu: "Pa",
  fri: "Ju",
  sat: "Sha",
  sun: "Ya",
};

export interface PortalGroupCardProps {
  group: PortalGroupItem;
  className?: string;
}

/**
 * O'quvchi portali guruh kartochkasi (Guruh box komponenti).
 * Guruh nomi, kursi, soati, kunlari, xonasi, o'qituvchisi va holatini ko'rsatadi.
 * Muallif / Agent: Google Gemini
 */
export function PortalGroupCard({ group: g, className = "" }: PortalGroupCardProps) {
  const daysText = g.days.map((d) => PORTAL_DAY_LABELS[d] ?? d).join(", ");

  return (
    <Link href={`/portal/guruhlar/${g.id}`} className={className}>
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
}

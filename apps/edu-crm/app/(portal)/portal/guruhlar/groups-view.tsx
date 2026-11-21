"use client";

import { UsersRound } from "lucide-react";
import * as React from "react";
import { Card } from "@ventura/ui/card";
import type { PortalGroupItem } from "@/lib/server/portal";
import { PortalGroupCard } from "./group-card";
import { uz } from "@/lib/uz";

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
          {groups.map((g) => (
            <PortalGroupCard key={g.id} group={g} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <UsersRound className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-body font-bold text-foreground">Siz hali birorta guruhga qo'shilmagansiz</h3>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">{uz.portal.guruhgaQoshilishUchunOquv}</p>
        </Card>
      )}
    </div>
  );
}

"use client";

import { BookOpen, Calendar, CheckCircle2, Clock, User, XCircle } from "lucide-react";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { formatDate } from "@/lib/format";
import type { PortalHomeworkItem } from "@/lib/server/portal";

/**
 * O'quvchi uy vazifalari sahifasi (ADR 0063).
 * O'qituvchi tashlagan homeworklar ro'yxati va holati.
 * Muallif / Agent: Google Gemini
 */
export function PortalHomeworkView({ items }: { items: PortalHomeworkItem[] }) {
  const [filter, setFilter] = React.useState<"all" | "pending" | "done" | "undone">("all");

  const visible = items.filter((h) => {
    if (filter === "all") return true;
    return h.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-title text-foreground">Uy vazifalari</h1>
          <p className="text-body text-muted-foreground">O'qituvchilaringiz tomonidan berilgan barcha topshiriqlar</p>
        </div>

        {/* Filtr tugmalari */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-control self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Hammasi ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "pending" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kutilmoqda ({items.filter((i) => i.status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("done")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "done" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bajarildi ({items.filter((i) => i.status === "done").length})
          </button>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-4">
          {visible.map((h) => (
            <Card key={h.id} className="p-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-primary">{h.groupName}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-caption text-muted-foreground">{h.courseName}</span>
                  </div>
                  <h2 className="text-subheading font-bold text-foreground mt-0.5">{h.title}</h2>
                </div>

                <div className="self-start sm:self-auto shrink-0">
                  {h.status === "done" ? (
                    <Badge tone="success" className="gap-1">
                      <CheckCircle2 className="size-3.5" /> Bajarildi
                    </Badge>
                  ) : h.status === "undone" ? (
                    <Badge tone="danger" className="gap-1">
                      <XCircle className="size-3.5" /> Bajarilmadi
                    </Badge>
                  ) : (
                    <Badge tone="warning" className="gap-1">
                      <Clock className="size-3.5" /> Kutilmoqda
                    </Badge>
                  )}
                </div>
              </div>

              {h.description ? (
                <div className="p-3.5 rounded-control bg-muted/40 border border-border-soft text-body text-foreground whitespace-pre-wrap">
                  {h.description}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border-soft text-caption text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" /> Dars sanasi:{" "}
                    <strong className="text-foreground">{formatDate(h.lessonDate)}</strong>
                  </span>
                  {h.dueDate ? (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-warning-fg" /> Muddat:{" "}
                      <strong className="text-foreground">{formatDate(h.dueDate)}</strong>
                    </span>
                  ) : null}
                </div>

                <span className="flex items-center gap-1.5">
                  <User className="size-3.5" /> O'qituvchi: {h.teacherName}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <BookOpen className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-body font-bold text-foreground">Topshiriqlar mavjud emas</h3>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Hozircha sizga biriktirilgan yangi uy vazifalari yo'q.
          </p>
        </Card>
      )}
    </div>
  );
}

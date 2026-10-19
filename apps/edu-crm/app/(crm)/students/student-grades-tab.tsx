"use client";

import { GraduationCap } from "lucide-react";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState } from "@ventura/ui/page-header";
import { formatDate } from "@/lib/format";
import { gradePercent } from "@/lib/grades";
import type { StudentGradeGroup } from "@/lib/server/grades";
import { uz } from "@/lib/uz";
import { GroupChip } from "../student-table";

const t = uz.grades;

/** O'quvchi profili, "Baholar" tabi (ADR 0061): guruhlar bo'yicha o'rtacha baho, uy vazifasi va oxirgi darslar */
export function StudentGradesTab({ groups }: { groups: StudentGradeGroup[] }) {
  if (!groups.length) return <EmptyState icon={<GraduationCap />} title={t.studentEmpty} />;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.groupId} className="space-y-3 rounded-card border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GroupChip id={g.groupId} name={g.groupName} />
            <div className="flex flex-wrap gap-4 text-caption text-muted-foreground">
              <span>
                {t.studentAverage}:{" "}
                <b className="text-foreground">{g.average === null ? "—" : uz.attendance.rate(g.average)}</b> (
                {t.studentGraded(g.graded)})
              </span>
              <span>
                {t.studentHomework}:{" "}
                <b className="text-foreground">
                  {g.homeworkMarked ? t.homeworkRate(g.homeworkDone, g.homeworkMarked) : "—"}
                </b>
              </span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-caption font-semibold text-muted-foreground">{t.studentRecent}</div>
            <ul className="flex flex-wrap gap-1.5">
              {g.recent.map((r) => (
                <li
                  key={r.date}
                  className="flex items-center gap-1.5 rounded-badge border border-border-soft bg-muted px-2 py-0.5 text-caption"
                >
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                  {r.score !== null ? (
                    <b
                      className={cn(
                        gradePercent(r.score, r.scale) >= 80
                          ? "text-(--success-fg)"
                          : gradePercent(r.score, r.scale) >= 50
                            ? "text-(--warning-fg)"
                            : "text-(--danger-fg)",
                      )}
                    >
                      {r.score}/{r.scale}
                    </b>
                  ) : null}
                  {r.homework !== null ? (
                    <span className={r.homework ? "text-(--success-fg)" : "text-(--danger-fg)"}>
                      {r.homework ? t.homeworkDone : t.homeworkNotDone}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

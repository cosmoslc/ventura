import Link from "next/link";
import { Avatar } from "@ventura/ui/avatar";
import { Card } from "@ventura/ui/card";
import type { TeachersViewData } from "@/lib/server/teacher-reports";
import { uz } from "@/lib/uz";
import { PctBar } from "./pct-bar";

const t = uz.reports.teachers;

export const RETENTION_COLOR = "var(--chart-1)";
export const ATTENDANCE_COLOR = "var(--chart-2)";
const MARKED_COLOR = "var(--chart-3)";

/** Reyting yetakchisi kartasi: o'rni, o'qituvchi, yuklamasi va uchta ko'rsatkich */
export function LeaderCard({ teacher, rank }: { teacher: TeachersViewData["teachers"][number]; rank: number }) {
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={teacher.name} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/teachers/${teacher.id}`}
            className="block truncate text-body font-semibold text-foreground hover:text-primary-text"
            title={teacher.name}
          >
            {teacher.name}
          </Link>
          <p className="truncate text-caption text-muted-foreground">
            {t.load(teacher.groups, teacher.students, teacher.hours)}
          </p>
        </div>
        <span className="shrink-0 self-start text-caption font-semibold text-muted-foreground">{t.rankOf(rank)}</span>
      </div>
      <div className="space-y-3">
        <PctBar label={t.retention} value={teacher.retention} color={RETENTION_COLOR} />
        <PctBar label={t.attendance} value={teacher.attendance} color={ATTENDANCE_COLOR} />
        <PctBar label={t.markedRate} value={teacher.markedRate} color={MARKED_COLOR} />
      </div>
    </Card>
  );
}

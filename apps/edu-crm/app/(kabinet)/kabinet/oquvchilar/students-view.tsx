"use client";

import { GraduationCap, KeyRound, TrendingDown, UserCheck, Users } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { displayPhone, money } from "@/lib/format";
import { masteryLevel } from "@/lib/kabinet-stats";
import type { KabinetStudent } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { StatusBadge } from "../../../(crm)/students/student-dialogs";
import { GroupChip, MoreRows, StudentsTable } from "../../../(crm)/student-table";
import { setStudentPasswordByTeacherAction } from "../actions";

const t = uz.kabinet;
const ALL = "all";
const PAGE_ROWS = 30;
const STATUSES = ["active", "trial", "paused"] as const;

export function StudentsView({ rows }: { rows: KabinetStudent[] }) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [limit, setLimit] = React.useState(PAGE_ROWS);
  const [passStudent, setPassStudent] = React.useState<KabinetStudent | null>(null);
  const [newPass, setNewPass] = React.useState("");
  const [savingPass, startPassTransition] = React.useTransition();

  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passStudent || !newPass) return;
    startPassTransition(async () => {
      const res = await setStudentPasswordByTeacherAction({ studentId: passStudent.id, password: newPass });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: "Parol muvaffaqiyatli saqlandi" });
      setPassStudent(null);
      setNewPass("");
    });
  }

  const groupOptions = [...new Map(rows.flatMap((r) => r.groups.map((g) => [g.id, g.name] as const))).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows.filter((r) => {
    if (group !== ALL && !r.groups.some((g) => g.id === group)) return false;
    if (status !== ALL && !r.groups.some((g) => (group === ALL || g.id === group) && g.status === status)) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (!!digits && r.phone.includes(digits));
  });
  const withCoins = rows.some((r) => r.coins !== null);
  const count = (s: string) => rows.filter((r) => r.groups.some((g) => g.status === s)).length;
  const low = rows.filter((r) => r.average !== null && masteryLevel(r.average) === "low").length;
  const pct = (v: number | null) => (v === null ? t.none : `${v}%`);

  return (
    <div className="space-y-section">
      <PageHeader title={t.studentsTitle} description={t.studentsDescription} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone={1} icon={<Users />} label={t.statTotal} value={uz.common.count(rows.length)} />
        <StatCard tone={2} icon={<UserCheck />} label={t.statActive} value={uz.common.count(count("active"))} />
        <StatCard tone={4} icon={<GraduationCap />} label={t.statTrial} value={uz.common.count(count("trial"))} />
        <StatCard tone={3} icon={<TrendingDown />} label={t.statLow} value={uz.common.count(low)} />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.colGroups}
          value={group}
          onValueChange={setGroup}
          options={[
            { value: ALL, label: t.filterAllGroups },
            ...groupOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          label={t.colStatus}
          value={status}
          onValueChange={setStatus}
          options={[
            { value: ALL, label: t.allStatuses },
            ...STATUSES.map((s) => ({ value: s, label: uz.students.status[s] })),
          ]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{uz.coins.count(visible.length, rows.length)}</span>
        </FilterEnd>
      </FilterBar>

      <StudentsTable
        rows={visible.slice(0, limit)}
        rowKey={(r) => r.id}
        numbered
        student={(r) => ({ name: r.name, href: null, sub: displayPhone(r.phone) })}
        studentHeader={t.colStudent}
        columns={[
          {
            key: "groups",
            header: t.colGroups,
            cell: (r) => (
              <div className="flex max-w-72 flex-wrap gap-1">
                {r.groups.map((g) => (
                  <GroupChip
                    key={g.id}
                    id={g.id}
                    name={g.name}
                    href={`/kabinet/guruhlar/${g.id}`}
                    muted={group !== ALL && g.id !== group}
                  />
                ))}
              </div>
            ),
          },
          {
            key: "attendance",
            header: t.colAttendance,
            align: "right",
            className: "font-mono tabular-nums",
            cell: (r) => pct(r.attendance),
          },
          {
            key: "average",
            header: t.colAverage,
            align: "right",
            className: "whitespace-nowrap",
            cell: (r) =>
              r.average === null ? (
                <span className="text-muted-foreground">{t.none}</span>
              ) : (
                <span className="font-mono font-semibold tabular-nums">
                  {r.average}% · {t.levels[masteryLevel(r.average)]}
                </span>
              ),
          },
          ...(withCoins
            ? [
                {
                  key: "coins",
                  header: t.colCoins,
                  align: "right" as const,
                  className: "font-mono font-semibold tabular-nums",
                  cell: (r: KabinetStudent) => money(r.coins ?? 0),
                },
              ]
            : []),
          { key: "status", header: t.colStatus, cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (r: KabinetStudent) => (
              <Button
                variant="icon"
                size="icon-sm"
                title={r.hasLogin ? "Parolni yangilash" : "Kirish paroli berish"}
                onClick={() => {
                  setPassStudent(r);
                  setNewPass("");
                }}
              >
                <KeyRound className={r.hasLogin ? "text-primary" : "text-muted-foreground"} />
              </Button>
            ),
          },
        ]}
        footer={
          visible.length > limit ? (
            <MoreRows onClick={() => setLimit((n) => n + PAGE_ROWS)}>
              {uz.coins.showMore(Math.min(PAGE_ROWS, visible.length - limit))}
            </MoreRows>
          ) : null
        }
        empty={<EmptyState icon={<Users />} title={rows.length ? t.nothingFound : t.studentsEmpty} />}
      />

      <Modal
        open={!!passStudent}
        onOpenChange={(open) => !open && setPassStudent(null)}
        title={
          passStudent
            ? `${passStudent.name} — ${passStudent.hasLogin ? "Parolni yangilash" : "Kirish paroli berish"}`
            : ""
        }
      >
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <Label htmlFor="kabinet-student-pass">Yangi parol</Label>
            <Input
              id="kabinet-student-pass"
              type="password"
              placeholder="Kamida 6 belgi"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPassStudent(null)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={savingPass || newPass.length < 6}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

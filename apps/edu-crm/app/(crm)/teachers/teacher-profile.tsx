"use client";

import { ArrowLeft, Clock, Layers, Pencil, Trash2, UserCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { archiveTeacherAction } from "./actions";
import type { TeacherRef, TeacherRow } from "./data";
import { TeacherForm } from "./teacher-form";
import { type TeacherPerms, hoursLabel, salaryLabel } from "./teachers-view";

export function TeacherProfile({
  teacher: t,
  supports,
  mentor,
  mentors,
  branches,
  selectedBranch,
  perms,
}: {
  teacher: TeacherRow;
  supports: { id: string; name: string }[];
  mentor: TeacherRef | null;
  mentors: { id: string; name: string }[];
  branches: PickerBranch[];
  selectedBranch: string;
  perms: TeacherPerms;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const support = t.kind === "support";
  const branch = branches.find((b) => b.id === t.branchId);
  const back = support ? "/teachers?tab=support" : "/teachers";

  async function archive() {
    const res = await archiveTeacherAction(t.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: uz.teachers.archived, description: t.name });
    router.push(back);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="icon" size="icon" asChild title={uz.teachers.back} aria-label={uz.teachers.back}>
            <Link href={back}>
              <ArrowLeft />
            </Link>
          </Button>
          <Avatar name={t.name} size={46} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-heading text-title text-foreground">{t.name}</h1>
              <Badge tone={support ? "info" : "success"}>
                {support ? uz.teachers.kindSupport : uz.teachers.kindTeacher}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{displayPhone(t.phone)}</span>
              {branch ? (
                <>
                  <span aria-hidden>•</span>
                  <span>{branch.name}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {perms.edit ? (
            <Button variant="ghost" onClick={() => setFormOpen(true)}>
              <Pencil /> {uz.teachers.edit}
            </Button>
          ) : null}
          {perms.delete ? (
            <Button
              variant="icon"
              size="icon"
              className="text-destructive-text"
              title={uz.teachers.archive}
              aria-label={uz.teachers.archive}
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone={2}
          icon={<Wallet />}
          label={uz.teachers.colSalary}
          value={salaryLabel(t)}
          hint={<div>{uz.teachers.salaryTypeName[t.salaryType]}</div>}
        />
        {support ? (
          <StatCard
            tone={1}
            icon={<Clock />}
            label={uz.teachers.colHours}
            value={hoursLabel(t) ?? uz.teachers.notSet}
            hint={
              <div>
                {t.workingDays.length ? t.workingDays.map((d) => uz.weekdays.short[d]).join(", ") : uz.teachers.notSet}
              </div>
            }
          />
        ) : (
          <StatCard tone={1} icon={<Layers />} label={uz.teachers.colGroups} value={uz.common.count(t.groups)} />
        )}
        <StatCard tone={3} icon={<Users />} label={uz.teachers.colStudents} value={uz.common.count(t.students)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-5">
          <h2 className="flex items-center gap-2 border-b border-border-soft pb-3 text-body font-bold text-foreground">
            <UserCheck className="size-4 text-primary" /> {uz.teachers.mainInfo}
          </h2>
          <dl className="divide-y divide-border-soft text-body">
            <Row label={uz.teachers.phone}>{displayPhone(t.phone)}</Row>
            <Row label={uz.teachers.branch}>{branch?.name ?? uz.teachers.notSet}</Row>
            {support ? (
              <Row label={uz.teachers.assignedTeacher}>
                {mentor ? (
                  <Link href={`/teachers/${mentor.id}`} className="hover:text-primary">
                    {mentor.archived ? `${mentor.name} ${uz.teachers.archivedSuffix}` : mentor.name}
                  </Link>
                ) : (
                  uz.teachers.notAssigned
                )}
              </Row>
            ) : (
              <>
                <Row label={uz.teachers.gender}>
                  {t.gender === "female"
                    ? uz.teachers.female
                    : t.gender === "male"
                      ? uz.teachers.male
                      : uz.teachers.notSet}
                </Row>
                <Row label={uz.teachers.birthDate}>{t.birthDate ? formatDate(t.birthDate) : uz.teachers.notSet}</Row>
              </>
            )}
            <Row label={uz.teachers.salaryType}>{uz.teachers.salaryTypeName[t.salaryType]}</Row>
          </dl>
          <div className="pt-2">
            <div className="mb-1 text-caption font-semibold text-muted-foreground">{uz.teachers.note}</div>
            <p className="rounded-control border border-border-soft bg-muted px-3 py-2.5 text-body text-foreground">
              {t.note || uz.teachers.noNote}
            </p>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-7">
          {!support ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 border-b border-border-soft pb-3 text-body font-bold text-foreground">
                <UserCheck className="size-4 text-primary" /> {uz.teachers.supports}
              </h2>
              {supports.length ? (
                <ul className="mt-3 space-y-2">
                  {supports.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/teachers/${s.id}`}
                        className="flex items-center gap-2.5 rounded-control bg-muted px-3 py-2 text-body font-semibold text-foreground hover:text-primary"
                      >
                        <Avatar name={s.name} size={26} /> {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-body text-muted-foreground">{uz.teachers.noSupports}</p>
              )}
            </Card>
          ) : null}
          <Notice tone="info">{uz.teachers.groupsLater}</Notice>
        </div>
      </div>

      {perms.edit ? (
        <TeacherForm
          open={formOpen}
          onOpenChange={setFormOpen}
          kind={t.kind}
          editing={t}
          mentors={mentors}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title={uz.teachers.archiveTitle}
        message={uz.teachers.archiveMessage(t.name)}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-60 truncate text-right font-bold text-foreground">{children}</dd>
    </div>
  );
}

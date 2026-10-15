"use client";

import { ArrowLeft, KeyRound, Pencil, ShieldCheck, Sparkles, UserCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { StatCard } from "@ventura/ui/stat-card";
import { displayPhone, formatDate, money } from "@/lib/format";
import { type FormField, fieldText, formCompletion } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { PositionOption, StaffRow } from "./data";
import { StaffForm } from "./staff-form";
import { StaffMenu, type StaffPerms } from "./staff-menu";
import { FormBadge, PositionChips, StateBadges } from "./staff-view";

export function StaffDetail({
  row,
  positions,
  branches,
  selectedBranch,
  fields,
  perms,
  canViewLog = false,
}: {
  row: StaffRow;
  positions: PositionOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  fields: FormField[];
  perms: StaffPerms;
  /** "Tizim harakatlari jurnali" ruxsati: xodimning faoliyatiga havola */
  canViewLog?: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const c = formCompletion(row.customData, fields);
  const branchNames =
    branches
      .filter((b) => row.branchIds.includes(b.id))
      .map((b) => b.name)
      .join(", ") || uz.staff.noBranch;
  const canEdit = perms.edit && row.manageable;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="icon" size="icon" asChild title={uz.staff.back} aria-label={uz.staff.back}>
            <Link href="/staff">
              <ArrowLeft />
            </Link>
          </Button>
          <Avatar name={row.name} size={46} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-heading text-title text-foreground">{row.name}</h1>
              <PositionChips positions={row.positions} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">
                {displayPhone(row.phone) ?? uz.staff.phoneMissing}
              </span>
              <span aria-hidden>•</span>
              <span>{branchNames}</span>
              <span aria-hidden>•</span>
              <Badge tone={row.salaryType === "kpi" ? "info" : "success"}>{uz.staff.salaryType[row.salaryType]}</Badge>
            </div>
            <StateBadges row={row} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canViewLog ? (
            <Button variant="ghost" asChild>
              <Link href={`/activity?actor=${row.id}`}>{uz.activityLog.staffLink}</Link>
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="ghost" onClick={() => setFormOpen(true)}>
              <Pencil /> {uz.staff.edit}
            </Button>
          ) : null}
          <StaffMenu row={row} perms={perms} showDetails={false} onArchived={() => router.push("/staff")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone={2}
          icon={<Wallet />}
          label={uz.staff.salaryLabel}
          value={`${money(row.monthlySalary)} ${uz.common.som}`}
          hint={
            row.salaryType === "kpi" ? (
              <div>{uz.staff.kpiDetail(money(row.kpiStudentAmount), money(row.kpiContractBonus))}</div>
            ) : (
              <div>{uz.staff.salaryType.fixed}</div>
            )
          }
        />
        <StatCard
          tone={1}
          icon={<ShieldCheck />}
          label={uz.staff.access}
          value={uz.staff.permissionCount(row.permissionCount)}
          hint={<div>{uz.staff.permissionsOf(row.positions.length)}</div>}
        />
        <StatCard
          tone={4}
          icon={<KeyRound />}
          label={uz.staff.loginState}
          value={row.locked ? uz.staff.locked : row.mustChangePassword ? uz.staff.mustChange : uz.staff.loginActive}
          hint={<div>{row.telegramLinked ? uz.staff.telegramOk : uz.staff.telegramMissing}</div>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="space-y-1 p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-border-soft pb-3">
            <h2 className="flex items-center gap-2 text-body font-bold text-foreground">
              <UserCheck className="size-4 text-primary" /> {uz.staff.mainInfo}
            </h2>
          </div>
          <dl className="divide-y divide-border-soft text-body">
            <Row label={uz.staff.phone}>{displayPhone(row.phone) ?? uz.staff.notSet}</Row>
            <Row label={uz.staff.salaryLabel}>
              {money(row.monthlySalary)} {uz.common.som}
            </Row>
            <Row label={uz.staff.salaryKind}>{uz.staff.salaryType[row.salaryType]}</Row>
            <Row label={uz.staff.branchLabel}>{branchNames}</Row>
            <Row label={uz.staff.birthDate}>{row.birthDate ? formatDate(row.birthDate) : uz.staff.notSet}</Row>
            <Row label={uz.staff.gender}>
              {row.gender === "female" ? uz.staff.female : row.gender === "male" ? uz.staff.male : uz.staff.notSet}
            </Row>
            {row.address ? <Row label={uz.staff.address}>{row.address}</Row> : null}
          </dl>
          <div className="pt-2">
            <div className="mb-1 text-caption font-semibold text-muted-foreground">{uz.staff.note}</div>
            <p className="rounded-control border border-border-soft bg-muted px-3 py-2.5 text-body text-foreground">
              {row.note || uz.staff.noNote}
            </p>
          </div>
        </Card>

        <Card className="space-y-3 p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border-soft pb-3">
            <h2 className="flex items-center gap-2 text-body font-bold text-foreground">
              <Sparkles className="size-4 text-primary" /> {uz.staff.extraInfo}
            </h2>
            {fields.length ? <FormBadge filled={c.filled} total={c.total} /> : null}
          </div>
          {fields.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => {
                const v = fieldText(f, row.customData[f.id], {
                  yes: uz.staff.yes,
                  no: uz.staff.no,
                  groupName: () => undefined,
                });
                return (
                  <div key={f.id} className="rounded-control border border-border-soft bg-muted px-3 py-2.5">
                    <div className="text-caption font-semibold text-muted-foreground">{f.label}</div>
                    <div className="mt-0.5 truncate text-body font-bold text-foreground">
                      {v ? v : <span className="font-normal text-muted-foreground italic">{uz.staff.notSet}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-body text-muted-foreground">{uz.staff.fieldsEmpty}</p>
          )}
          <p className="text-caption text-muted-foreground">{uz.staff.filled(c.filled, c.total)}</p>
        </Card>
      </div>

      {canEdit ? (
        <StaffForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={row}
          positions={positions}
          branches={branches}
          selectedBranch={selectedBranch}
          fields={fields}
          perms={perms}
          onSaved={() => router.refresh()}
        />
      ) : null}
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

"use client";

import { Layers, LogOut, MoreHorizontal, Pause, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { EmptyState } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import { formatDate, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { pauseMembershipAction } from "./actions";
import type { StudentMembershipRow } from "./data";
import { MembershipBadge } from "./group-profile";
import { daysLabel, type GroupPerms } from "./groups-view";
import {
  ActivateDialog,
  EnrollDialog,
  LeaveDialog,
  type MembershipTarget,
  type PickOption,
} from "./membership-dialogs";

/** O'quvchi profilidagi "Guruhlar" tabi: ochiq a'zoliklar kartalari va oldingi guruhlar */
export function StudentGroupsTab({
  studentId,
  studentName,
  memberships,
  groupOptions,
  perms,
}: {
  studentId: string;
  studentName: string;
  memberships: StudentMembershipRow[];
  groupOptions: PickOption[];
  perms: GroupPerms;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [activate, setActivate] = React.useState<MembershipTarget | null>(null);
  const [leave, setLeave] = React.useState<MembershipTarget | null>(null);
  const [pending, startTransition] = React.useTransition();

  const open = memberships.filter((m) => !m.leftAt);
  const past = memberships.filter((m) => m.leftAt);
  const inGroup = new Set(open.map((m) => m.groupId));
  const options = groupOptions.filter((g) => !inGroup.has(g.id));
  const target = (m: StudentMembershipRow): MembershipTarget => ({
    id: m.id,
    studentName,
    groupName: m.groupName,
    enrolledAt: m.enrolledAt,
  });

  function pause(m: StudentMembershipRow, on: boolean) {
    startTransition(async () => {
      const res = await pauseMembershipAction({ id: m.id, pause: on });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: on ? uz.groups.frozen : uz.groups.unfrozen, description: m.groupName });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-body font-bold text-foreground">{uz.students.groupsTitle(open.length)}</div>
          <div className="text-caption text-muted-foreground">{uz.students.groupsSubtitle}</div>
        </div>
        {perms.addStudent ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> {uz.groups.profileAdd}
          </Button>
        ) : null}
      </div>

      {open.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {open.map((m) => (
            <div
              key={m.id}
              className="space-y-3 rounded-card border border-l-4 border-border-soft p-4"
              style={{ borderLeftColor: m.groupColor }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/groups/${m.groupId}`}
                    className="text-body font-bold text-foreground hover:text-primary"
                  >
                    {m.groupName}
                  </Link>
                  <div className="text-caption text-muted-foreground">
                    {m.courseName} · {m.teacherName}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <MembershipBadge status={m.status} activatedAt={m.activatedAt} />
                  <MembershipMenu
                    m={m}
                    perms={perms}
                    disabled={pending}
                    onActivate={() => setActivate(target(m))}
                    onPause={(on) => pause(m, on)}
                    onLeave={() => setLeave(target(m))}
                  />
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
                <dt className="text-muted-foreground">{uz.groups.daysCard}:</dt>
                <dd className="text-foreground">
                  {daysLabel(m.days)} · {m.startTime} - {m.endTime}
                </dd>
                <dt className="text-muted-foreground">{uz.groups.enrolledAt}</dt>
                <dd className="font-mono text-foreground">{formatDate(m.enrolledAt)}</dd>
                <dt className="text-muted-foreground">{uz.groups.activatedAt}</dt>
                <dd className="font-mono text-foreground">
                  {m.activatedAt ? formatDate(m.activatedAt) : uz.groups.notActivated}
                </dd>
                {m.pausedAt ? (
                  <>
                    <dt className="text-muted-foreground">{uz.groups.pausedAt}</dt>
                    <dd className="font-mono text-foreground">{formatDate(m.pausedAt)}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">{uz.groups.price}:</dt>
                <dd className="font-mono text-foreground">
                  {money(m.price)} {uz.groups.perMonth}
                </dd>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Layers />} title={uz.students.groupsEmpty} />
      )}

      {past.length ? (
        <div>
          <div className="mb-2 text-body font-bold text-foreground">{uz.groups.historyGroups}</div>
          <ul className="divide-y divide-border-soft rounded-card border border-border-soft">
            {past.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-caption">
                <span className="font-semibold text-foreground">{m.groupName}</span>
                <span className="font-mono text-muted-foreground">
                  {formatDate(m.enrolledAt)} → {m.leftAt ? formatDate(m.leftAt) : ""}
                </span>
                {m.leftReason ? <span className="w-full text-muted-foreground">{m.leftReason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {perms.addStudent ? (
        <EnrollDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          title={uz.groups.profileAdd}
          searchPlaceholder={uz.groups.profileChoose}
          emptyText={uz.groups.profileNoGroups}
          options={options}
          pair={(groupId) => ({ groupId, studentId })}
        />
      ) : null}
      <ActivateDialog target={activate} onOpenChange={(o) => !o && setActivate(null)} />
      <LeaveDialog target={leave} onOpenChange={(o) => !o && setLeave(null)} />
    </div>
  );
}

/** Guruh kartasidagi amallar — uch nuqta menyusida (faollashtirish, muzlatish, guruhdan chiqarish) */
function MembershipMenu({
  m,
  perms,
  disabled,
  onActivate,
  onPause,
  onLeave,
}: {
  m: StudentMembershipRow;
  perms: GroupPerms;
  disabled: boolean;
  onActivate: () => void;
  onPause: (on: boolean) => void;
  onLeave: () => void;
}) {
  const activate = m.status === "trial" && perms.addStudent;
  const freeze = perms.freeze && m.status !== "trial";
  if (!activate && !freeze && !perms.removeStudent) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          disabled={disabled}
          title={uz.common.actions}
          aria-label={`${m.groupName} — ${uz.common.actions}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {activate ? (
          <DropdownMenuItem onSelect={onActivate}>
            <Play /> {uz.groups.activate}
          </DropdownMenuItem>
        ) : null}
        {freeze ? (
          <DropdownMenuItem onSelect={() => onPause(m.status !== "paused")}>
            {m.status === "paused" ? <Play /> : <Pause />}
            {m.status === "paused" ? uz.groups.unfreeze : uz.groups.freeze}
          </DropdownMenuItem>
        ) : null}
        {perms.removeStudent ? (
          <>
            {activate || freeze ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem danger onSelect={onLeave}>
              <LogOut /> {uz.groups.remove}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

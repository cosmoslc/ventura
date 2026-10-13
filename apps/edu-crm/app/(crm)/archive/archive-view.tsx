"use client";

import { Archive, BookOpen, GraduationCap, Layers, RotateCcw, Search, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { displayPhone } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { purgeStudentAction, restoreArchivedAction } from "./actions";
import type { ArchiveData } from "./data";

type Tab = "students" | "groups" | "courses" | "teachers" | "leads";
type Kind = "student" | "group" | "course" | "teacher" | "lead";
const KIND: Record<Tab, Kind> = {
  students: "student",
  groups: "group",
  courses: "course",
  teachers: "teacher",
  leads: "lead",
};

function dateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })} ${d.toLocaleTimeString("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function ArchiveView({
  data,
  branches,
  canRestore,
  canPurge,
}: {
  data: ArchiveData;
  branches: PickerBranch[];
  canRestore: boolean;
  canPurge: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("students");
  const [query, setQuery] = React.useState("");
  const [confirm, setConfirm] = React.useState<{ kind: "restore" | "purge"; id: string; name: string } | null>(null);
  const branchName = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? "—") : "—");

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const hit = (name: string, phones: (string | null)[]) =>
    !q || name.toLowerCase().includes(q) || (!!digits && phones.some((p) => (p ?? "").includes(digits)));
  const studentsList = data.students.filter((s) => hit(s.name, [s.phone, s.parentPhone]));
  const coursesList = data.courses.filter((c) => hit(c.name, []));
  const teachersList = data.teachers.filter((t) => hit(t.name, [t.phone]));
  const groupsList = data.groups.filter((g) => hit(g.name, []));
  const leadsList = data.leads.filter((l) => hit(l.name, [l.phone]));
  const count = {
    students: studentsList.length,
    groups: groupsList.length,
    courses: coursesList.length,
    teachers: teachersList.length,
    leads: leadsList.length,
  }[tab];
  const items =
    tab === "courses" ? coursesList : tab === "groups" ? groupsList : tab === "leads" ? leadsList : teachersList;
  const withPhone = tab === "teachers" || tab === "leads";

  async function run() {
    if (!confirm) return;
    const res =
      confirm.kind === "restore"
        ? await restoreArchivedAction({ kind: KIND[tab], id: confirm.id })
        : await purgeStudentAction(confirm.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({
      tone: "success",
      title: confirm.kind === "restore" ? uz.archive.restored : uz.archive.purged,
      description: confirm.name,
    });
    router.refresh();
  }

  const actions = (id: string, name: string, purge: boolean) => (
    <div className="flex justify-end gap-1.5">
      {canRestore ? (
        <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "restore", id, name })}>
          <RotateCcw /> {uz.archive.restore}
        </Button>
      ) : null}
      {purge && canPurge ? (
        <Button
          variant="icon"
          size="icon-sm"
          className="text-destructive-text"
          title={uz.archive.purge}
          aria-label={`${name} — ${uz.archive.purge}`}
          onClick={() => setConfirm({ kind: "purge", id, name })}
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={uz.archive.title} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="students">
            <GraduationCap /> {uz.archive.tabStudents} <Badge tone="neutral">{data.students.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Layers /> {uz.archive.tabGroups} <Badge tone="neutral">{data.groups.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="courses">
            <BookOpen /> {uz.archive.tabCourses} <Badge tone="neutral">{data.courses.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="teachers">
            <Users /> {uz.archive.tabTeachers} <Badge tone="neutral">{data.teachers.length}</Badge>
          </TabsTrigger>
          {data.leads.length ? (
            <TabsTrigger value="leads">
              <UserPlus /> {uz.archive.tabLeads} <Badge tone="neutral">{data.leads.length}</Badge>
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>

      <FilterBar standalone>
        <div className="sm:max-w-sm">
          <Input
            icon={<Search />}
            placeholder={uz.archive.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </FilterBar>

      <Card className="overflow-hidden">
        {count === 0 ? (
          <EmptyState
            icon={<Archive />}
            title={q ? uz.archive.notFound : uz.archive.empty}
            description={q ? undefined : uz.archive.emptyHint}
          />
        ) : (
          <TableWrap>
            {tab === "students" ? (
              <Table className="min-w-[860px]">
                <THead>
                  <tr>
                    <Th>{uz.archive.colStudent}</Th>
                    <Th>{uz.archive.colPhones}</Th>
                    <Th>{uz.archive.colBranch}</Th>
                    <Th>{uz.archive.colDeleted}</Th>
                    <Th className="text-right">{uz.common.actions}</Th>
                  </tr>
                </THead>
                <TBody>
                  {studentsList.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.name} size={32} />
                          <div className="min-w-0">
                            <div className="truncate text-body font-bold text-foreground">{s.name}</div>
                            {s.reason ? (
                              <div className="truncate text-caption text-muted-foreground">
                                {uz.archive.reason(s.reason)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="font-mono">{displayPhone(s.phone) ?? "—"}</div>
                        {s.parentPhone ? (
                          <div className="text-caption text-muted-foreground">
                            {uz.archive.parent(displayPhone(s.parentPhone) ?? s.parentPhone)}
                          </div>
                        ) : null}
                      </Td>
                      <Td>{branchName(s.branchId)}</Td>
                      <Td>
                        <div className="font-mono">{dateTime(s.archivedAt)}</div>
                        {s.archivedByName ? (
                          <div className="text-caption text-muted-foreground">{uz.archive.by(s.archivedByName)}</div>
                        ) : null}
                      </Td>
                      <Td className="text-right">{actions(s.id, s.name, true)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <Table className="min-w-[720px]">
                <THead>
                  <tr>
                    <Th>{uz.archive.colName}</Th>
                    {withPhone ? <Th>{uz.archive.colPhones}</Th> : null}
                    <Th>{uz.archive.colBranch}</Th>
                    <Th>{uz.archive.colDeleted}</Th>
                    <Th className="text-right">{uz.common.actions}</Th>
                  </tr>
                </THead>
                <TBody>
                  {items.map((it) => (
                    <Tr key={it.id}>
                      <Td className="font-bold text-foreground">{it.name}</Td>
                      {withPhone ? (
                        <Td className="font-mono">{it.phone ? (displayPhone(it.phone) ?? "—") : "—"}</Td>
                      ) : null}
                      <Td>{it.branchId ? branchName(it.branchId) : uz.common.allBranches}</Td>
                      <Td className="font-mono">{dateTime(it.archivedAt)}</Td>
                      <Td className="text-right">{actions(it.id, it.name, false)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </TableWrap>
        )}
      </Card>

      <ConfirmModal
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "purge" ? uz.archive.purgeTitle : uz.archive.restoreTitle}
        message={confirm ? (confirm.kind === "purge" ? uz.archive.purgeMessage(confirm.name) : confirm.name) : ""}
        confirmLabel={confirm?.kind === "purge" ? uz.archive.purgeConfirm : uz.archive.restoreConfirm}
        cancelLabel={uz.common.cancel}
        onConfirm={() => void run()}
      />
    </div>
  );
}

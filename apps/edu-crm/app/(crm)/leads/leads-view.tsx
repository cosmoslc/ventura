"use client";

import { CalendarClock, ClipboardList, Columns3, Phone, Plus, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox } from "@ventura/ui/checkbox";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { DEFAULT_LEAD_FIELDS, FIELD_TYPES, type FormField } from "@/lib/form-fields";
import { LEAD_SOURCES, daysIn } from "@/lib/leads";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { FieldsModal } from "../fields-modal";
import { moveLeadAction, saveLeadFieldsAction } from "./actions";
import type { LeadRow, StageRow, StaffOption } from "./data";
import { ArchiveDialog, AssignDialog, LeadMenu, MoveDialog, StageBadge, StagesModal } from "./lead-dialogs";
import { LeadForm } from "./lead-form";
import type { LeadPerms } from "./perms";

const t = uz.leads;
const ALL = "all";
const NONE = "none";
type View = "board" | "list";

/**
 * Lidlar (E4a, ADR 0022): doska — ish bosqichlari ustunlarda, kartani sudrab yoki menyudan boshqa ustunga o'tkazish;
 * ro'yxat — jadval, tanlab mas'ul belgilash. Filtrlar ikkala ko'rinishga umumiy.
 */
export function LeadsView({
  stages,
  rows,
  courses,
  staff,
  fields,
  branches,
  selectedBranch,
  today,
  me,
  perms,
}: {
  stages: StageRow[];
  rows: LeadRow[];
  courses: { id: string; name: string }[];
  staff: StaffOption[];
  fields: FormField[];
  branches: PickerBranch[];
  selectedBranch: string;
  today: string;
  me: string;
  perms: LeadPerms;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("board");
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState(ALL);
  const [course, setCourse] = React.useState(ALL);
  const [assignee, setAssignee] = React.useState(ALL);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LeadRow | null>(null);
  const [moving, setMoving] = React.useState<LeadRow | null>(null);
  const [assigning, setAssigning] = React.useState<{ ids: string[]; current: string | null } | null>(null);
  const [archiving, setArchiving] = React.useState<LeadRow | null>(null);
  const [stagesOpen, setStagesOpen] = React.useState(false);
  const [fieldsOpen, setFieldsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  // Sudrab ko'chirishda server javobini kutmasdan ko'rsatish
  const [optimistic, setOptimistic] = React.useState<Record<string, string>>({});

  const stageOf = (l: LeadRow) => optimistic[l.id] ?? l.stageId;
  const openStages = stages.filter((s) => s.kind === "open");
  const openIds = new Set(openStages.map((s) => s.id));
  const active = rows.filter((l) => openIds.has(stageOf(l)));

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filtered = active.filter((l) => {
    if (source !== ALL && l.source !== source) return false;
    if (course !== ALL && l.courseId !== course) return false;
    if (assignee === NONE ? !!l.assignedTo : assignee !== ALL && l.assignedTo !== assignee) return false;
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) || (!!digits && (l.phone.includes(digits) || (l.phone2 ?? "").includes(digits)))
    );
  });
  const filtering = !!q || source !== ALL || course !== ALL || assignee !== ALL;
  const counts = Object.fromEntries(stages.map((s) => [s.id, rows.filter((l) => stageOf(l) === s.id).length]));
  const sources = [...new Set([...LEAD_SOURCES, ...rows.flatMap((l) => (l.source ? [l.source] : []))])];

  function openForm(row: LeadRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  async function drop(leadId: string, stageId: string) {
    const lead = rows.find((l) => l.id === leadId);
    if (!lead || stageOf(lead) === stageId) return;
    setOptimistic((o) => ({ ...o, [leadId]: stageId }));
    const res = await moveLeadAction({ id: leadId, stageId });
    if (!res.ok) {
      setOptimistic((o) => {
        const { [leadId]: _, ...rest } = o;
        return rest;
      });
      return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
    }
    toast({ tone: "success", title: t.moved(stages.find((s) => s.id === stageId)?.name ?? "") });
    router.refresh();
  }

  // Server yangi ma'lumot berganda optimistik holat tozalanadi
  const [seenRows, setSeenRows] = React.useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setOptimistic({});
  }

  const menu = (l: LeadRow) => (
    <LeadMenu
      lead={l}
      perms={perms}
      onEdit={() => openForm(l)}
      onMove={() => setMoving(l)}
      onAssign={() => setAssigning({ ids: [l.id], current: l.assignedTo })}
      onArchive={() => setArchiving(l)}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            {perms.edit ? (
              <>
                <Button variant="ghost" onClick={() => setStagesOpen(true)}>
                  <Columns3 /> {t.stagesButton}
                </Button>
                <Button variant="ghost" onClick={() => setFieldsOpen(true)}>
                  <ClipboardList /> {t.fieldsButton}
                </Button>
              </>
            ) : null}
            {perms.create ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {t.add}
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.source}
          value={source}
          onValueChange={setSource}
          options={[{ value: ALL, label: t.allSources }, ...sources.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label={t.course}
          value={course}
          onValueChange={setCourse}
          options={[{ value: ALL, label: t.allCourses }, ...courses.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect
          label={t.assigned}
          value={assignee}
          onValueChange={setAssignee}
          options={[
            { value: ALL, label: t.allStaff },
            { value: NONE, label: t.unassigned },
            ...staff.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(filtered.length)}</span>
        </FilterEnd>
      </FilterBar>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="board">{t.viewBoard}</TabsTrigger>
          <TabsTrigger value="list">{t.viewList}</TabsTrigger>
        </TabsList>
      </Tabs>

      {!rows.length ? (
        <Card>
          <EmptyState icon={<UserPlus />} title={t.empty} description={t.emptyHint} />
        </Card>
      ) : view === "board" ? (
        <Board
          stages={openStages}
          leads={filtered}
          stageOf={stageOf}
          today={today}
          canMove={perms.move}
          onDrop={drop}
          menu={menu}
        />
      ) : (
        <LeadsTable
          leads={filtered}
          stages={stages}
          stageOf={stageOf}
          selected={selected}
          setSelected={setSelected}
          canAssign={perms.reassign}
          onAssign={(ids) => setAssigning({ ids, current: null })}
          menu={menu}
          filtering={filtering}
        />
      )}

      {perms.create || perms.edit ? (
        <LeadForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          branches={branches}
          selectedBranch={selectedBranch}
          courses={courses}
          staff={staff}
          fields={fields}
          me={me}
          canReassign={perms.reassign}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <MoveDialog lead={moving} stages={stages} onClose={() => setMoving(null)} />
      <AssignDialog
        ids={assigning?.ids ?? null}
        current={assigning?.current ?? null}
        staff={staff}
        onClose={() => setAssigning(null)}
        onDone={() => setSelected(new Set())}
      />
      <ArchiveDialog lead={archiving} onClose={() => setArchiving(null)} />
      {perms.edit ? (
        <>
          <StagesModal open={stagesOpen} onOpenChange={setStagesOpen} stages={stages} counts={counts} />
          <FieldsModal
            open={fieldsOpen}
            onOpenChange={setFieldsOpen}
            fields={fields}
            canWrite
            defaults={DEFAULT_LEAD_FIELDS}
            types={FIELD_TYPES.filter((x) => x !== "group")}
            save={saveLeadFieldsAction}
            title={t.fieldsTitle}
            description={t.fieldsIntro}
          />
        </>
      ) : null}
    </div>
  );
}

function Board({
  stages,
  leads,
  stageOf,
  today,
  canMove,
  onDrop,
  menu,
}: {
  stages: StageRow[];
  leads: LeadRow[];
  stageOf: (l: LeadRow) => string;
  today: string;
  canMove: boolean;
  onDrop: (leadId: string, stageId: string) => void;
  menu: (l: LeadRow) => React.ReactNode;
}) {
  const [over, setOver] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
      {stages.map((s) => {
        const items = leads.filter((l) => stageOf(l) === s.id);
        return (
          <section
            key={s.id}
            aria-label={s.name}
            onDragOver={(e) => {
              if (!canMove || !dragging) return;
              e.preventDefault();
              setOver(s.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/lead");
              setOver(null);
              setDragging(null);
              if (id) onDrop(id, s.id);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-card border border-border-soft bg-muted/60 transition-colors",
              over === s.id && "border-(--ring-border) bg-primary-soft",
            )}
          >
            <header
              className="flex items-center justify-between gap-2 border-t-4 px-3 pt-3 pb-2"
              style={{ borderTopColor: s.color }}
            >
              <span className="flex min-w-0 items-center gap-2 text-body font-bold text-foreground">
                <span className="truncate">{s.name}</span>
              </span>
              <Badge tone="neutral">{items.length}</Badge>
            </header>
            <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
              {items.length ? (
                items.map((l) => (
                  <article
                    key={l.id}
                    draggable={canMove}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/lead", l.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(l.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "group rounded-control border border-border-soft bg-card p-3 shadow-card transition-[opacity,box-shadow]",
                      canMove && "cursor-grab active:cursor-grabbing",
                      dragging === l.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/leads/${l.id}`}
                        className="min-w-0 text-body font-bold text-foreground hover:text-primary"
                        draggable={false}
                      >
                        <span className="line-clamp-2">{l.name}</span>
                      </Link>
                      {menu(l)}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
                      <Phone className="size-3.5" /> {displayPhone(l.phone)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {l.courseName ? <Badge tone="info">{l.courseName}</Badge> : null}
                      {l.source ? <Badge tone="neutral">{l.source}</Badge> : null}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-soft pt-2 text-caption text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {l.assignedName ? (
                          <>
                            <Avatar name={l.assignedName} size={18} />
                            <span className="truncate">{l.assignedName}</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3.5" /> {t.unassigned}
                          </>
                        )}
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1",
                          l.targetDate && l.targetDate <= today && "font-semibold text-(--warning-fg)",
                        )}
                        title={l.targetDate ? `${t.targetDate}: ${formatDate(l.targetDate)}` : undefined}
                      >
                        {l.targetDate ? <CalendarClock className="size-3.5" /> : null}
                        {l.targetDate ? formatDate(l.targetDate) : t.days(daysIn(l.stageChangedAt, today))}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <div
                  className={cn(
                    "grid flex-1 place-items-center rounded-control border border-dashed border-border-soft py-6 text-caption text-muted-foreground",
                    over === s.id && "border-(--ring-border)",
                  )}
                >
                  {dragging ? t.dropHere : t.columnEmpty}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LeadsTable({
  leads,
  stages,
  stageOf,
  selected,
  setSelected,
  canAssign,
  onAssign,
  menu,
  filtering,
}: {
  leads: LeadRow[];
  stages: StageRow[];
  stageOf: (l: LeadRow) => string;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  canAssign: boolean;
  onAssign: (ids: string[]) => void;
  menu: (l: LeadRow) => React.ReactNode;
  filtering: boolean;
}) {
  if (!leads.length)
    return (
      <Card>
        <EmptyState icon={<UserPlus />} title={filtering ? t.emptyFiltered : t.empty} />
      </Card>
    );
  const visibleIds = leads.map((l) => l.id);
  const chosen = visibleIds.filter((id) => selected.has(id));
  const all = chosen.length === visibleIds.length;
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  return (
    <Card className="overflow-hidden">
      {canAssign && chosen.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-2.5">
          <span className="text-body font-semibold text-foreground">{t.selected(chosen.length)}</span>
          <Button size="sm" onClick={() => onAssign(chosen)}>
            <UserCheck /> {t.assignSelected}
          </Button>
        </div>
      ) : null}
      <TableWrap className="rounded-none border-0">
        <Table>
          <THead>
            <Tr>
              {canAssign ? (
                <Th className="w-10">
                  <Checkbox
                    aria-label={t.selected(visibleIds.length)}
                    checked={all ? true : chosen.length ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(visibleIds) : new Set())}
                  />
                </Th>
              ) : null}
              <Th>{t.colName}</Th>
              <Th>{t.colStage}</Th>
              <Th>{t.colSource}</Th>
              <Th>{t.colCourse}</Th>
              <Th>{t.colAssigned}</Th>
              <Th>{t.colTarget}</Th>
              <Th>{t.colCreated}</Th>
              <Th className="text-right">{uz.common.actions}</Th>
            </Tr>
          </THead>
          <TBody>
            {leads.map((l) => (
              <Tr key={l.id}>
                {canAssign ? (
                  <Td>
                    <Checkbox
                      aria-label={l.name}
                      checked={selected.has(l.id)}
                      onCheckedChange={(v) => toggle(l.id, v === true)}
                    />
                  </Td>
                ) : null}
                <Td>
                  <Link href={`/leads/${l.id}`} className="font-semibold text-foreground hover:text-primary">
                    {l.name}
                  </Link>
                  <div className="font-mono text-caption text-muted-foreground">{displayPhone(l.phone)}</div>
                </Td>
                <Td>
                  <StageBadge stage={stages.find((s) => s.id === stageOf(l))} />
                </Td>
                <Td className="text-muted-foreground">{l.source ?? "—"}</Td>
                <Td className="text-muted-foreground">{l.courseName ?? "—"}</Td>
                <Td className="text-muted-foreground">{l.assignedName ?? t.unassigned}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {l.targetDate ? formatDate(l.targetDate) : "—"}
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDate(new Date(l.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }))}
                </Td>
                <Td>
                  <div className="flex justify-end">{menu(l)}</div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </Card>
  );
}

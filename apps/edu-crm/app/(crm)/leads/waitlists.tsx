"use client";

import { Archive, ListPlus, Pencil, Plus, Rocket, UserMinus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState } from "@ventura/ui/page-header";
import { SearchSelect } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { type CourseOption, GroupForm, type RoomOption, type TeacherOption } from "../groups/group-form";
import { activateWaitlistAction, assignWaitlistAction, closeWaitlistAction, saveWaitlistAction } from "./actions";
import type { LeadGroupOption, LeadRow, WaitlistRow } from "./data";
import type { LeadPerms } from "./perms";

const t = uz.leads;

/** Guruh ochish formasi uchun (faollashtirishda "Yangi guruh ochish") */
export interface GroupFormData {
  courses: CourseOption[];
  teachers: TeacherOption[];
  rooms: RoomOption[];
  canChangeTeacher: boolean;
}

/** Zahira guruh ochish va tahrirlash */
export function WaitlistDialog({
  open,
  onOpenChange,
  editing,
  courses,
  branches,
  selectedBranch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WaitlistRow | null;
  courses: { id: string; name: string }[];
  branches: PickerBranch[];
  selectedBranch: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [courseId, setCourseId] = React.useState<string[]>([]);
  const [branchId, setBranchId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(editing?.name ?? "");
      setCourseId(editing?.courseId ? [editing.courseId] : []);
      setBranchId(editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")));
      setNote(editing?.note ?? "");
      setError(null);
    }
  }
  const showBranch = branches.length > 1 && selectedBranch === "all" && !editing;

  function save() {
    startTransition(async () => {
      const res = await saveWaitlistAction({
        id: editing?.id,
        branchId: branchId || null,
        name,
        courseId: courseId[0] ?? null,
        note,
      });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.waitlistSaved, description: name });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={editing ? t.waitlistEdit : t.waitlistNew}
      description={t.waitlistIntro}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            {uz.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="waitlist-name">{t.waitlistName} *</Label>
          <Input
            id="waitlist-name"
            autoFocus
            maxLength={120}
            placeholder={t.waitlistNamePlaceholder}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div>
          <Label>{t.waitlistCourse}</Label>
          <SearchSelect
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
            value={courseId}
            onChange={setCourseId}
            placeholder={t.noCourse}
            searchPlaceholder={t.courseSearch}
            emptyText={uz.common.nothingFound}
          />
        </div>
        {showBranch ? (
          <div>
            <Label>{uz.common.branch}</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={uz.common.chooseBranch} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="waitlist-note">{t.waitlistNote}</Label>
          <Textarea
            id="waitlist-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

/** Lidni zahira guruhga yozish (lid filialidagi ochiq ro'yxatlardan) yoki chiqarish */
export function WaitlistAssignDialog({
  lead,
  waitlists,
  onClose,
}: {
  lead: LeadRow | null;
  waitlists: WaitlistRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [choice, setChoice] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((lead?.id ?? null) !== shownFor) {
    setShownFor(lead?.id ?? null);
    setChoice(lead?.waitlistId ?? "");
  }
  const options = lead ? waitlists.filter((w) => w.branchId === lead.branchId) : [];

  function run(waitlistId: string | null) {
    if (!lead) return;
    startTransition(async () => {
      const res = await assignWaitlistAction({ leadIds: [lead.id], waitlistId });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: waitlistId ? t.waitlistAssigned : t.waitlistRemoved, description: lead.name });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={lead ? t.waitlistAssignTitle(lead.name) : t.waitlistAssign}
      footer={
        <>
          {lead?.waitlistId ? (
            <Button
              variant="ghost"
              className="mr-auto text-destructive-text"
              disabled={pending}
              onClick={() => run(null)}
            >
              <UserMinus /> {t.waitlistRemove}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button disabled={pending || !choice || choice === lead?.waitlistId} onClick={() => run(choice)}>
            <ListPlus /> {t.waitlistAssign}
          </Button>
        </>
      }
    >
      {options.length ? (
        <div className="grid gap-2" role="radiogroup" aria-label={t.waitlistChoose}>
          {options.map((w) => (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={choice === w.id}
              onClick={() => setChoice(w.id)}
              className="flex flex-col items-start rounded-control border border-border-soft px-3 py-2.5 text-left transition-colors hover:bg-accent aria-checked:border-(--ring-border) aria-checked:bg-primary-soft"
            >
              <span className="text-body font-semibold text-foreground">{w.name}</span>
              {w.courseName ? <span className="text-caption text-muted-foreground">{w.courseName}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <Notice tone="info">{t.waitlistNone}</Notice>
      )}
    </Modal>
  );
}

/**
 * Faollashtirish: mavjud guruhni tanlash yoki yangi guruh ochish (forma zahira nomi va kursi bilan ochiladi; saqlangach
 * shu guruhga faollashtiriladi). Hammasi o'quvchi bo'lib sinovda qo'shiladi.
 */
export function ActivateWaitlistDialog({
  waitlist,
  waiting,
  groups,
  groupForm,
  branches,
  onClose,
}: {
  waitlist: WaitlistRow | null;
  waiting: number;
  groups: LeadGroupOption[];
  /** null — xodim guruh ocholmaydi (faqat mavjud guruhga) */
  groupForm: GroupFormData | null;
  branches: PickerBranch[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [groupId, setGroupId] = React.useState<string[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((waitlist?.id ?? null) !== shownFor) {
    setShownFor(waitlist?.id ?? null);
    setMode("existing");
    setGroupId([]);
    setError(null);
  }
  const options = waitlist ? groups.filter((g) => g.branchId === waitlist.branchId) : [];

  function activate(id: string) {
    if (!waitlist) return;
    startTransition(async () => {
      const res = await activateWaitlistAction({ waitlistId: waitlist.id, groupId: id });
      if (!res.ok) {
        setError(res.error);
        return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      }
      toast({ tone: "success", title: t.waitlistActivated(res.count), description: waitlist.name });
      onClose();
      router.push(`/groups/${id}`);
    });
  }

  return (
    <>
      <Modal
        open={waitlist !== null && !formOpen}
        onOpenChange={(o) => !o && onClose()}
        position="center"
        title={waitlist ? t.waitlistActivateTitle(waitlist.name) : t.waitlistActivate}
        description={t.waitlistActivateIntro(waiting)}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {uz.common.cancel}
            </Button>
            {mode === "existing" ? (
              <Button
                disabled={pending}
                onClick={() => (groupId[0] ? activate(groupId[0]) : setError(t.waitlistGroupRequired))}
              >
                <Rocket /> {t.waitlistActivate}
              </Button>
            ) : (
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> {t.waitlistNewGroup}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {groupForm ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
              <TabsList>
                <TabsTrigger value="existing">{t.waitlistExisting}</TabsTrigger>
                <TabsTrigger value="new">{t.waitlistNewGroup}</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          {mode === "existing" ? (
            <SearchSelect
              options={options}
              value={groupId}
              onChange={(v) => {
                setGroupId(v);
                setError(null);
              }}
              placeholder={uz.staff.chooseGroup}
              searchPlaceholder={uz.staff.searchGroup}
              emptyText={uz.common.nothingFound}
            />
          ) : null}
          {error ? <FieldHint error>{error}</FieldHint> : null}
        </div>
      </Modal>
      {groupForm && waitlist ? (
        <GroupForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={null}
          courses={groupForm.courses}
          teachers={groupForm.teachers}
          rooms={groupForm.rooms}
          branches={branches.filter((b) => b.id === waitlist.branchId)}
          selectedBranch={waitlist.branchId}
          canChangeTeacher={groupForm.canChangeTeacher}
          preset={{ name: waitlist.name, courseId: waitlist.courseId, branchId: waitlist.branchId }}
          onSaved={(id) => {
            setFormOpen(false);
            activate(id);
          }}
        />
      ) : null}
    </>
  );
}

/** "Zahira guruhlar" tabi: ochiq ro'yxatlar, kutayotgan lidlar va amallar */
export function WaitlistsPanel({
  waitlists,
  leads,
  branches,
  selectedBranch,
  courses,
  groups,
  groupForm,
  perms,
}: {
  waitlists: WaitlistRow[];
  leads: LeadRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  groups: LeadGroupOption[];
  groupForm: GroupFormData | null;
  perms: LeadPerms;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<WaitlistRow | null | undefined>(undefined);
  const [activating, setActivating] = React.useState<WaitlistRow | null>(null);
  const [closing, setClosing] = React.useState<WaitlistRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const members = (w: WaitlistRow) => leads.filter((l) => l.waitlistId === w.id);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name;

  function remove(l: LeadRow) {
    startTransition(async () => {
      const res = await assignWaitlistAction({ leadIds: [l.id], waitlistId: null });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.waitlistRemoved, description: l.name });
      router.refresh();
    });
  }

  async function close(w: WaitlistRow) {
    const res = await closeWaitlistAction(w.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: t.waitlistClosed, description: w.name });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {perms.edit ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditing(null)}>
            <Plus /> {t.waitlistAdd}
          </Button>
        </div>
      ) : null}
      {waitlists.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {waitlists.map((w) => {
            const list = members(w);
            return (
              <Card key={w.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-body font-bold text-foreground">{w.name}</div>
                    <div className="text-caption text-muted-foreground">
                      {[w.courseName, branches.length > 1 ? branchName(w.branchId) : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <Badge tone={list.length ? "info" : "neutral"}>{t.waitlistWaiting(list.length)}</Badge>
                </div>
                {w.note ? <p className="text-caption text-muted-foreground">{w.note}</p> : null}
                {list.length ? (
                  <ul className="divide-y divide-border-soft rounded-control border border-border-soft">
                    {list.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <Link href={`/leads/${l.id}`} className="font-semibold text-foreground hover:text-primary">
                            {l.name}
                          </Link>
                          <div className="font-mono text-caption text-muted-foreground">{displayPhone(l.phone)}</div>
                        </div>
                        {perms.edit ? (
                          <Button
                            variant="icon"
                            size="icon-sm"
                            title={t.waitlistRemove}
                            aria-label={`${l.name} — ${t.waitlistRemove}`}
                            disabled={pending}
                            onClick={() => remove(l)}
                          >
                            <UserMinus />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-caption text-muted-foreground">{t.waitlistEmpty}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {perms.convert ? (
                    <Button size="sm" disabled={!list.length} onClick={() => setActivating(w)}>
                      <Rocket /> {t.waitlistActivate}
                    </Button>
                  ) : null}
                  {perms.edit ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
                        <Pencil /> {uz.common.edit}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive-text" onClick={() => setClosing(w)}>
                        <Archive /> {t.waitlistClose}
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Users />} title={t.waitlistEmptyList} description={t.waitlistEmptyHint} />
        </Card>
      )}

      <WaitlistDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        editing={editing ?? null}
        courses={courses}
        branches={branches}
        selectedBranch={selectedBranch}
      />
      <ActivateWaitlistDialog
        waitlist={activating}
        waiting={activating ? members(activating).length : 0}
        groups={groups}
        groupForm={groupForm}
        branches={branches}
        onClose={() => setActivating(null)}
      />
      <ConfirmModal
        open={closing !== null}
        onOpenChange={(o) => !o && setClosing(null)}
        title={closing ? t.waitlistCloseTitle(closing.name) : t.waitlistClose}
        message={t.waitlistCloseMessage}
        confirmLabel={t.waitlistClose}
        cancelLabel={uz.common.cancel}
        onConfirm={() => closing && void close(closing)}
      />
    </div>
  );
}

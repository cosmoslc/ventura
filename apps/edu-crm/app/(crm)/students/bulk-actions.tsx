"use client";

import { MessageSquareText, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { SearchSelect, type SearchSelectOption } from "@ventura/ui/search-select";
import { SelectionBar, SelectionBarAction } from "@ventura/ui/selection-bar";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { type BulkResult, enrollStudentsAction, leaveStudentsAction } from "../groups/actions";
import { LeaveReasonFields } from "../groups/leave-reason-fields";
import type { StudentRow } from "./data";

const t = uz.students;

export interface BulkGroupOption extends SearchSelectOption {
  branchId: string;
}

export interface BulkPerms {
  /** Guruhga qo'shish uchun guruhlar; null — ruxsat yo'q */
  enroll: BulkGroupOption[] | null;
  /** Guruhdan chiqarish ruxsati */
  remove: boolean;
}

const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

/**
 * Tanlangan o'quvchilar uchun pastdagi amallar paneli (ADR 0028): guruhga qo'shish, guruhdan chiqarish va SMS (SMS
 * bo'limi ulanganda). Har amal bitta so'rov bilan, natija — nechtasi bajarildi va nechtasi o'tkazildi.
 */
export function StudentsBulkBar({
  selected,
  onClear,
  perms,
}: {
  selected: StudentRow[];
  onClear: () => void;
  perms: BulkPerms;
}) {
  const [dialog, setDialog] = React.useState<"enroll" | "leave" | null>(null);
  // Chiqarish uchun: tanlanganlar a'zo bo'lgan guruhlar (nechta o'quvchi bilan)
  const memberGroups = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; teacher: string | null; n: number }>();
    for (const s of selected)
      for (const g of s.groups) {
        const cur = map.get(g.id);
        map.set(g.id, cur ? { ...cur, n: cur.n + 1 } : { id: g.id, name: g.name, teacher: g.teacher, n: 1 });
      }
    return [...map.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [selected]);

  return (
    <>
      <SelectionBar count={selected.length} label={t.selectedCount} onClear={onClear} clearLabel={t.clearSelection}>
        {perms.enroll ? (
          <SelectionBarAction icon={<UserPlus />} onClick={() => setDialog("enroll")}>
            {t.bulkEnroll}
          </SelectionBarAction>
        ) : null}
        {perms.remove ? (
          <SelectionBarAction
            icon={<UserMinus />}
            tone="danger"
            disabled={!memberGroups.length}
            title={memberGroups.length ? undefined : t.bulkNoGroups}
            onClick={() => setDialog("leave")}
          >
            {t.bulkLeave}
          </SelectionBarAction>
        ) : null}
        <SelectionBarAction icon={<MessageSquareText />} disabled title={t.bulkSmsSoon}>
          {t.bulkSms}
        </SelectionBarAction>
      </SelectionBar>
      {perms.enroll ? (
        <EnrollDialog
          open={dialog === "enroll"}
          onOpenChange={(o) => setDialog(o ? "enroll" : null)}
          selected={selected}
          groups={perms.enroll}
          onDone={onClear}
        />
      ) : null}
      {perms.remove ? (
        <LeaveDialog
          open={dialog === "leave"}
          onOpenChange={(o) => setDialog(o ? "leave" : null)}
          selected={selected}
          groups={memberGroups}
          onDone={onClear}
        />
      ) : null}
    </>
  );
}

/** Natija: bajarildi — xabar va tanlov tozalanadi; tasdiqqa yuborildi — info; xato — oynada */
function useBulkSubmit(onOpenChange: (open: boolean) => void, onDone: () => void, success: (n: number) => string) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  function submit(run: () => Promise<BulkResult>) {
    setError(null);
    startTransition(async () => {
      const res = await run();
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        onDone();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: success(res.done),
        description: res.skipped ? t.bulkSkipped(res.skipped) : undefined,
      });
      onOpenChange(false);
      onDone();
      router.refresh();
    });
  }
  return { error, setError, pending, submit };
}

function EnrollDialog({
  open,
  onOpenChange,
  selected,
  groups,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: StudentRow[];
  groups: BulkGroupOption[];
  onDone: () => void;
}) {
  const [groupId, setGroupId] = React.useState("");
  const { error, setError, pending, submit } = useBulkSubmit(onOpenChange, onDone, t.bulkEnrolled);
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setGroupId("");
      setError(null);
    }
  }
  const group = groups.find((g) => g.value === groupId);
  const already = group ? selected.filter((s) => s.groups.some((g) => g.id === group.value)).length : 0;
  const otherBranch = group ? selected.filter((s) => s.branchId !== group.branchId).length : 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.bulkEnrollTitle(selected.length)}
      description={t.bulkEnrollHint}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button
            disabled={pending || !groupId}
            onClick={() =>
              submit(() =>
                enrollStudentsAction({
                  groupId,
                  studentIds: selected.map((s) => s.id),
                  title: t.bulkTitle(selected.length),
                }),
              )
            }
          >
            <UserPlus /> {uz.groups.addButton}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{t.bulkGroup}</Label>
          <SearchSelect
            options={groups}
            value={groupId ? [groupId] : []}
            onChange={(v) => {
              setGroupId(v[0] ?? "");
              setError(null);
            }}
            placeholder={uz.staff.chooseGroup}
            searchPlaceholder={uz.staff.searchGroup}
            emptyText={uz.common.nothingFound}
          />
        </div>
        {already || otherBranch ? (
          <Notice tone="info">
            {[already ? t.bulkAlready(already) : null, otherBranch ? t.bulkOtherBranch(otherBranch) : null]
              .filter(Boolean)
              .join(" ")}
          </Notice>
        ) : null}
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

function LeaveDialog({
  open,
  onOpenChange,
  selected,
  groups,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: StudentRow[];
  groups: { id: string; name: string; teacher: string | null; n: number }[];
  onDone: () => void;
}) {
  const [groupId, setGroupId] = React.useState("");
  const [date, setDate] = React.useState(todayLocal);
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const { error, setError, pending, submit } = useBulkSubmit(onOpenChange, onDone, t.bulkLeft);
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setGroupId(groups.length === 1 ? groups[0]!.id : "");
      setDate(todayLocal());
      setReason("");
      setNote("");
      setError(null);
    }
  }
  const group = groups.find((g) => g.id === groupId);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.bulkLeaveTitle(selected.length)}
      description={t.bulkLeaveHint}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={pending || !groupId || !date}
            onClick={() => {
              if (!reason) return setError(uz.groups.removeReasonRequired);
              submit(() =>
                leaveStudentsAction({
                  groupId,
                  studentIds: selected.filter((s) => s.groups.some((g) => g.id === groupId)).map((s) => s.id),
                  date,
                  reason,
                  note,
                  title: t.bulkTitle(group?.n ?? selected.length),
                }),
              );
            }}
          >
            <UserMinus /> {group ? t.bulkLeaveButton(group.n) : uz.groups.remove}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{t.bulkGroup}</Label>
          <SearchSelect
            options={groups.map((g) => ({
              value: g.id,
              label: g.name,
              hint: `${g.teacher ?? uz.students.noTeacher} · ${t.bulkInGroup(g.n)}`,
            }))}
            value={groupId ? [groupId] : []}
            onChange={(v) => {
              setGroupId(v[0] ?? "");
              setError(null);
            }}
            placeholder={uz.staff.chooseGroup}
            searchPlaceholder={uz.staff.searchGroup}
            emptyText={uz.common.nothingFound}
          />
        </div>
        <div>
          <Label htmlFor="bulk-leave-date">{uz.groups.removeDate}</Label>
          <Input id="bulk-leave-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <LeaveReasonFields
          id="bulk-leave"
          reason={reason}
          onReason={(v) => {
            setReason(v);
            setError(null);
          }}
          note={note}
          onNote={setNote}
        />
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

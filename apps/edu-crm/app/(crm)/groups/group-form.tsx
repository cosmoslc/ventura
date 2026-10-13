"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { COURSE_COLORS } from "@/lib/palette";
import { firstError, groupInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { salaryLabel } from "../teachers/teachers-view";
import { saveGroupAction } from "./actions";
import type { GroupRow } from "./data";

type Weekday = GroupRow["days"][number];
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const NONE = "__none";
const DEFAULT = "__default";

export interface CourseOption {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  branchId: string | null;
  color: string;
}

export interface TeacherOption {
  id: string;
  name: string;
  branchId: string;
  salaryType: "percent" | "per_student" | "fixed";
  revenueSharePercent: number;
  perStudentSalary: number;
  fixedSalary: number;
}

export interface RoomOption {
  id: string;
  name: string;
  capacity: number;
  branchId: string | null;
}

interface Form {
  branchId: string;
  name: string;
  courseId: string;
  teacherId: string;
  roomId: string;
  price: number | null;
  durationMonths: string;
  days: Weekday[];
  startTime: string;
  endTime: string;
  startDate: string;
  color: string;
  salaryType: string;
  salaryPercent: string;
  salaryAmount: number | null;
  note: string;
  /** Narx o'zgarsa — yangi narx qaysi oydan ("YYYY-MM") */
  priceFrom: string;
}

/** "15:00" + 90 → "16:30" (yarim tundan oshmaydi) */
function addMinutes(t: string, m: number) {
  const [h = 0, mm = 0] = t.split(":").map(Number);
  const total = Math.min(h * 60 + mm + m, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function GroupForm({
  open,
  onOpenChange,
  editing,
  courses,
  teachers,
  rooms,
  branches,
  selectedBranch,
  canChangeTeacher,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: GroupRow | null;
  courses: CourseOption[];
  teachers: TeacherOption[];
  rooms: RoomOption[];
  branches: PickerBranch[];
  selectedBranch: string;
  canChangeTeacher: boolean;
  /** Yangi guruh uchun oldindan to'ldirish (zahira guruhni faollashtirish — ADR 0024) */
  preset?: { name: string; courseId: string | null; branchId: string };
  onSaved: (id: string) => void;
}) {
  const defaults = React.useCallback((): Form => {
    const branchId =
      editing?.branchId ?? preset?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? ""));
    return {
      branchId,
      name: editing?.name ?? preset?.name ?? "",
      courseId: editing?.courseId ?? preset?.courseId ?? "",
      teacherId: editing?.teacherId ?? "",
      roomId: editing?.roomId ?? "",
      price: editing ? editing.price : null,
      durationMonths: String(editing?.durationMonths ?? 3),
      days: editing?.days ?? ["mon", "wed", "fri"],
      startTime: editing?.startTime ?? "15:00",
      endTime: editing?.endTime ?? "16:30",
      startDate: editing?.startDate ?? todayLocal(),
      color: editing?.color ?? COURSE_COLORS[0]!.value,
      salaryType: editing?.teacherSalaryType ?? DEFAULT,
      salaryPercent: editing?.teacherSalaryPercent != null ? String(editing.teacherSalaryPercent) : "",
      salaryAmount: editing?.teacherSalaryAmount ?? null,
      note: editing?.note ?? "",
      priceFrom: todayLocal().slice(0, 7),
    };
  }, [editing, preset, selectedBranch, branches]);
  const [form, setForm] = React.useState(defaults);
  const priceChanged = !!editing && (form.price ?? 0) !== editing.price;
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setForm(defaults());
      setError(null);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const showBranch = branches.length > 1 && selectedBranch === "all" && !editing;
  // Filialga mos: kurs va xona — shu filial yoki umumiy; o'qituvchi — shu filial
  const branchCourses = courses.filter((c) => !c.branchId || c.branchId === form.branchId);
  const branchTeachers = teachers.filter((t) => t.branchId === form.branchId || t.id === editing?.teacherId);
  const branchRooms = rooms.filter((r) => !r.branchId || r.branchId === form.branchId);
  const teacher = teachers.find((t) => t.id === form.teacherId);

  function pickCourse(id: string) {
    const c = courses.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      courseId: id,
      // Yangi guruhda kurs narxi va davomiyligi olinadi (eski tizimdagidek)
      ...(c && !editing ? { price: c.price, durationMonths: String(c.durationMonths || 3), color: c.color } : {}),
    }));
    setError(null);
  }

  function toggleDay(d: Weekday) {
    set("days", form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const override = form.salaryType !== DEFAULT ? (form.salaryType as "percent" | "per_student" | "fixed") : null;
    const parsed = groupInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      courseId: form.courseId,
      teacherId: form.teacherId,
      roomId: form.roomId || null,
      price: form.price ?? 0,
      priceFrom: priceChanged ? form.priceFrom : null,
      durationMonths: form.durationMonths ? Number(form.durationMonths) : 0,
      days: WEEKDAYS.filter((d) => form.days.includes(d)),
      startTime: form.startTime,
      endTime: form.endTime,
      startDate: form.startDate,
      color: form.color,
      teacherSalaryType: override,
      teacherSalaryPercent: override === "percent" ? Number(form.salaryPercent || 0) : null,
      teacherSalaryAmount: override && override !== "percent" ? (form.salaryAmount ?? 0) : null,
      note: form.note,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveGroupAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.groups.updated : uz.groups.created, description: parsed.data.name });
      onOpenChange(false);
      onSaved(res.id);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? uz.groups.formEdit : uz.groups.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button
            type="submit"
            form="group-form"
            disabled={pending || !form.name.trim() || !form.courseId || !form.teacherId}
          >
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.groups.submitNew}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="group-name">{uz.groups.name} *</Label>
          <Input
            id="group-name"
            autoFocus
            placeholder={uz.groups.namePlaceholder}
            value={form.name}
            maxLength={120}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        {showBranch ? (
          <div>
            <Label>{uz.common.branch}</Label>
            <Select
              value={form.branchId}
              onValueChange={(v) => setForm((f) => ({ ...f, branchId: v, teacherId: "", roomId: "", courseId: "" }))}
            >
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
          <Label>{uz.groups.course} *</Label>
          <Select value={form.courseId} onValueChange={pickCourse}>
            <SelectTrigger className="w-full" aria-label={uz.groups.course} disabled={!!editing}>
              <SelectValue placeholder={uz.groups.chooseCourse} />
            </SelectTrigger>
            <SelectContent>
              {branchCourses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{uz.groups.room}</Label>
          <Select value={form.roomId || NONE} onValueChange={(v) => set("roomId", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full" aria-label={uz.groups.room}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{uz.groups.noRoom}</SelectItem>
              {branchRooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} · {uz.rooms.seatsUnit(r.capacity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="group-price">{uz.groups.price}</Label>
          <MoneyInput
            id="group-price"
            value={form.price}
            onValueChange={(v) => set("price", v)}
            suffix={uz.common.som}
            placeholder="150 000"
          />
        </div>
        {priceChanged ? (
          <div>
            <Label htmlFor="group-price-from">{uz.groups.priceFrom}</Label>
            <Input
              id="group-price-from"
              type="month"
              value={form.priceFrom}
              min={(editing!.startDate < form.startDate ? editing!.startDate : form.startDate).slice(0, 7)}
              max={todayLocal().slice(0, 7)}
              onChange={(e) => set("priceFrom", e.target.value)}
            />
            <FieldHint>{uz.groups.priceFromHint}</FieldHint>
          </div>
        ) : null}
        <div>
          <Label htmlFor="group-duration">{uz.groups.duration}</Label>
          <Input
            id="group-duration"
            inputMode="numeric"
            placeholder="3"
            value={form.durationMonths}
            onChange={(e) => set("durationMonths", e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <div>
          <Label>{uz.groups.teacher} *</Label>
          <Select value={form.teacherId} onValueChange={(v) => set("teacherId", v)}>
            <SelectTrigger className="w-full" aria-label={uz.groups.teacher} disabled={!!editing && !canChangeTeacher}>
              <SelectValue placeholder={uz.groups.chooseTeacher} />
            </SelectTrigger>
            <SelectContent>
              {branchTeachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{uz.groups.salaryType}</Label>
          <Select value={form.salaryType} onValueChange={(v) => set("salaryType", v)}>
            <SelectTrigger className="w-full" aria-label={uz.groups.salaryType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>
                {uz.groups.salaryDefault(
                  teacher
                    ? salaryLabel({
                        salaryType: teacher.salaryType,
                        revenueSharePercent: teacher.revenueSharePercent,
                        perStudentSalary: teacher.perStudentSalary,
                        fixedSalary: teacher.fixedSalary,
                      })
                    : "—",
                )}
              </SelectItem>
              {(["percent", "per_student", "fixed"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {uz.groups.salaryOptions[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.salaryType === "percent" ? (
          <div>
            <Label htmlFor="group-salary-percent">{uz.groups.salaryPercent}</Label>
            <Input
              id="group-salary-percent"
              inputMode="numeric"
              placeholder="40"
              value={form.salaryPercent}
              onChange={(e) => set("salaryPercent", e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
        ) : form.salaryType === "per_student" || form.salaryType === "fixed" ? (
          <div>
            <Label htmlFor="group-salary-amount">
              {form.salaryType === "per_student" ? uz.groups.salaryPerStudent : uz.groups.salaryFixed}
            </Label>
            <MoneyInput
              id="group-salary-amount"
              value={form.salaryAmount}
              onValueChange={(v) => set("salaryAmount", v)}
              suffix={uz.common.som}
              placeholder={form.salaryType === "per_student" ? "100 000" : "2 000 000"}
            />
          </div>
        ) : null}
        <div>
          <Label htmlFor="group-start-date">{uz.groups.startDate}</Label>
          <Input
            id="group-start-date"
            type="date"
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="group-start">{uz.groups.startTime}</Label>
            <Input
              id="group-start"
              type="time"
              value={form.startTime}
              onChange={(e) => {
                const v = e.target.value;
                // Tugash vaqti avtomatik 90 daqiqa keyin (eski tizimdagidek), o'zgartirsa bo'ladi
                setForm((f) => ({ ...f, startTime: v, endTime: v ? addMinutes(v, 90) : f.endTime }));
                setError(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="group-end">{uz.groups.endTime}</Label>
            <Input id="group-end" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>{uz.groups.days} *</Label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = form.days.includes(d);
              return (
                <Button
                  key={d}
                  size="sm"
                  variant={on ? "primary" : "ghost"}
                  aria-pressed={on}
                  title={uz.weekdays.full[d]}
                  onClick={() => toggleDay(d)}
                >
                  {uz.weekdays.short[d]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>{uz.groups.color}</Label>
          <ColorSwatches value={form.color} onChange={(v) => set("color", v)} options={COURSE_COLORS} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="group-note">{uz.groups.note}</Label>
          <Textarea
            id="group-note"
            rows={2}
            maxLength={1000}
            placeholder={uz.groups.notePlaceholder}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
        {error ? (
          <FieldHint error className="sm:col-span-2">
            {error}
          </FieldHint>
        ) : null}
      </form>
    </Modal>
  );
}

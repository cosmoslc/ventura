"use client";

import { BookOpen, Calendar, Clock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { formatDate } from "@/lib/format";
import type { KabinetGroup, KabinetHomeworkItem } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { createGroupHomeworkAction, deleteGroupHomeworkAction } from "../actions";

const t = uz.kabinet;

/**
 * O'qituvchi kabineti: Uy ishlari sahifasi ko'rinishi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export function TeacherHomeworksView({
  groups,
  homeworks,
  selectedGroupId,
  today,
}: {
  groups: KabinetGroup[];
  homeworks: KabinetHomeworkItem[];
  selectedGroupId?: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [customGroupId, setCustomGroupId] = React.useState<string | null>(null);
  const effectiveGroupId = customGroupId ?? (selectedGroupId || groups[0]?.id || "");

  const [lessonDate, setLessonDate] = React.useState(today);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function resetForm() {
    setCustomGroupId(null);
    setLessonDate(today);
    setTitle("");
    setDescription("");
    setDueDate("");
    setOpen(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveGroupId) {
      toast({ tone: "danger", title: "Guruhni tanlang" });
      return;
    }
    if (!title.trim()) {
      toast({ tone: "danger", title: "Topshiriq mavzusi / sarlavhasini kiriting" });
      return;
    }

    startTransition(async () => {
      const res = await createGroupHomeworkAction({
        groupId: effectiveGroupId,
        lessonDate,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      });

      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return;
      }

      toast({ tone: "success", title: t.homeworkCreated });
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(homeworkId: string, itemGroupId: string) {
    if (!window.confirm(t.homeworkDeleteConfirm)) return;
    setDeletingId(homeworkId);
    startTransition(async () => {
      const res = await deleteGroupHomeworkAction({ homeworkId, groupId: itemGroupId });
      setDeletingId(null);
      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return;
      }
      toast({ tone: "success", title: t.homeworkDeleted });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Sarlavha va yangi vazifa tugmasi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-title text-foreground">Uy ishlari</h1>
          <p className="text-body text-muted-foreground">
            Barcha guruhlaringizga berilgan topshiriqlar va yangi vazifa berish
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!groups.length}>
          <Plus /> {t.homeworkAdd}
        </Button>
      </div>

      {/* Guruhlar bo'yicha filtr */}
      {groups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link href="/kabinet/uy-ishi">
            <Badge
              tone={!selectedGroupId ? "info" : "neutral"}
              className="cursor-pointer px-3 py-1.5 transition-colors hover:opacity-80"
            >
              Barcha guruhlar ({groups.length})
            </Badge>
          </Link>
          {groups.map((g) => {
            const on = selectedGroupId === g.id;
            return (
              <Link key={g.id} href={`/kabinet/uy-ishi?groupId=${g.id}`}>
                <Badge
                  tone={on ? "info" : "neutral"}
                  className="cursor-pointer px-3 py-1.5 transition-colors hover:opacity-80 flex items-center gap-1.5"
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Vazifalar ro'yxati */}
      {homeworks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {homeworks.map((hw) => (
            <Card
              key={hw.id}
              className="p-5 space-y-3.5 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-2xs font-semibold text-primary font-mono block">
                      {hw.groupName} {hw.courseName ? `· ${hw.courseName}` : ""}
                    </span>
                    <h3 className="text-subheading font-bold text-foreground leading-snug mt-0.5">{hw.title}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive-text hover:bg-destructive-bg shrink-0 -mt-1 -mr-1"
                    title={uz.common.delete}
                    aria-label={uz.common.delete}
                    disabled={pending && deletingId === hw.id}
                    onClick={() => handleDelete(hw.id, hw.groupId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                  <Badge tone="neutral" className="flex items-center gap-1 font-mono">
                    <Calendar className="size-3" />
                    Dars: {formatDate(hw.lessonDate)}
                  </Badge>
                  {hw.dueDate ? (
                    <Badge tone="warning" className="flex items-center gap-1 font-mono">
                      <Clock className="size-3" />
                      Muddat: {formatDate(hw.dueDate)}
                    </Badge>
                  ) : null}
                </div>

                {hw.description ? (
                  <p className="text-caption text-foreground/90 whitespace-pre-wrap pt-1 leading-relaxed">
                    {hw.description}
                  </p>
                ) : (
                  <p className="text-caption italic text-muted-foreground pt-1">Batafsil izoh kiritilmagan</p>
                )}
              </div>

              <div className="pt-2.5 border-t border-border-soft flex items-center justify-between text-2xs text-muted-foreground font-mono">
                <span>Berildi: {formatDate(new Date(hw.createdAt).toISOString().slice(0, 10))}</span>
                <Link
                  href={`/kabinet/guruhlar/${hw.groupId}?tab=homework`}
                  className="text-primary hover:underline font-sans font-semibold"
                >
                  Guruhga o'tish →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title={selectedGroupId ? "Ushbu guruhga hali uy vazifasi berilmagan" : t.homeworkEmpty}
          description="Yangi topshiriq berish uchun yuqoridagi tugmani bosing. O'quvchilar uni o'z kabinetida ko'rishadi."
          action={
            <Button onClick={() => setOpen(true)} disabled={!groups.length} size="sm">
              <Plus /> {t.homeworkAdd}
            </Button>
          }
        />
      )}

      {/* Yangi uy vazifasi berish modali */}
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm();
          else setOpen(true);
        }}
        position="center"
        title={t.homeworkModalTitle}
        description={t.homeworkSubtitle}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={resetForm} disabled={pending}>
              {uz.common.cancel}
            </Button>
            <Button form="create-page-hw-form" type="submit" disabled={pending}>
              {pending ? "Saqlanmoqda..." : uz.common.save}
            </Button>
          </>
        }
      >
        <form id="create-page-hw-form" onSubmit={handleCreate} className="space-y-4">
          {/* Guruh tanlash */}
          <div className="space-y-1.5">
            <Label htmlFor="hw-group-select">Guruhni tanlang</Label>
            <select
              id="hw-group-select"
              className="w-full h-(--control-h) rounded-control border border-border bg-card px-3 text-body text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              required
              value={effectiveGroupId}
              onChange={(e) => setCustomGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.courseName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hw-page-lesson-date">{t.homeworkLessonDate}</Label>
              <Input
                id="hw-page-lesson-date"
                type="date"
                required
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hw-page-due-date">{t.homeworkDueDate}</Label>
              <Input
                id="hw-page-due-date"
                type="date"
                value={dueDate}
                min={lessonDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <FieldHint>Ixtiyoriy</FieldHint>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hw-page-title">{t.homeworkTaskTitle}</Label>
            <Input
              id="hw-page-title"
              placeholder="Masalan: 4-mavzu mashqlari, 32-bet"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hw-page-desc">{t.homeworkDescription}</Label>
            <Textarea
              id="hw-page-desc"
              placeholder="Topshiriq shartlari va qo'shimcha ko'rsatmalar..."
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldHint>O'quvchilar ushbu tavsifni o'z portalida ko'rishadi</FieldHint>
          </div>
        </form>
      </Modal>
    </div>
  );
}

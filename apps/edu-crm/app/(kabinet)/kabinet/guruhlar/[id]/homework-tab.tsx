"use client";

import { BookOpen, Calendar, Clock, Plus, Trash2 } from "lucide-react";
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
import type { KabinetHomeworkItem } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { createGroupHomeworkAction, deleteGroupHomeworkAction } from "../../actions";

const t = uz.kabinet;

/**
 * O'qituvchi guruhi ichidagi "Uy ishlari" tabi (ADR 0063).
 * Yangi topshiriq berish, mavjud vazifalar ro'yxati va o'chirish.
 * Muallif / Agent: Google Gemini
 */
export function HomeworkTab({
  groupId,
  today,
  homeworks,
}: {
  groupId: string;
  today: string;
  homeworks: KabinetHomeworkItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lessonDate, setLessonDate] = React.useState(today);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function resetForm() {
    setLessonDate(today);
    setTitle("");
    setDescription("");
    setDueDate("");
    setOpen(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({ tone: "danger", title: "Topshiriq mavzusi / sarlavhasini kiriting" });
      return;
    }

    startTransition(async () => {
      const res = await createGroupHomeworkAction({
        groupId,
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

  function handleDelete(homeworkId: string) {
    if (!window.confirm(t.homeworkDeleteConfirm)) return;
    setDeletingId(homeworkId);
    startTransition(async () => {
      const res = await deleteGroupHomeworkAction({ homeworkId, groupId });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-body font-bold text-foreground">{t.homeworkTitle}</h2>
          <p className="text-caption text-muted-foreground">{t.homeworkSubtitle}</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus /> {t.homeworkAdd}
        </Button>
      </div>

      {homeworks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {homeworks.map((hw) => (
            <Card key={hw.id} className="p-5 space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-body font-bold text-foreground leading-snug">{hw.title}</h3>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive-text hover:bg-destructive-bg shrink-0 -mt-1 -mr-1"
                    title={uz.common.delete}
                    aria-label={uz.common.delete}
                    disabled={pending && deletingId === hw.id}
                    onClick={() => handleDelete(hw.id)}
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

              <div className="pt-2 border-t border-border-soft flex items-center justify-between text-2xs text-muted-foreground font-mono">
                <span>Berilgan vaqti: {formatDate(new Date(hw.createdAt).toISOString().slice(0, 10))}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title={t.homeworkEmpty}
          description={t.homeworkEmptyHint}
          action={
            <Button onClick={() => setOpen(true)} size="sm">
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
            <Button form="create-group-hw-form" type="submit" disabled={pending}>
              {pending ? "Saqlanmoqda..." : uz.common.save}
            </Button>
          </>
        }
      >
        <form id="create-group-hw-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hw-lesson-date">{t.homeworkLessonDate}</Label>
              <Input
                id="hw-lesson-date"
                type="date"
                required
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hw-due-date">{t.homeworkDueDate}</Label>
              <Input
                id="hw-due-date"
                type="date"
                value={dueDate}
                min={lessonDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <FieldHint>Ixtiyoriy</FieldHint>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hw-title">{t.homeworkTaskTitle}</Label>
            <Input
              id="hw-title"
              placeholder="Masalan: 4-mavzu mashqlari, 32-bet"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hw-desc">{t.homeworkDescription}</Label>
            <Textarea
              id="hw-desc"
              placeholder="Topshiriq shartlari va ko'rsatmalar..."
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

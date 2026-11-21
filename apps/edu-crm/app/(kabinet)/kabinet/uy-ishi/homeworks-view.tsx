"use client";

import { BookOpen, Calendar, Clock, Inbox, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { EmptyState } from "@ventura/ui/page-header";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { HomeworkAttachment } from "@ventura/db/schema/tenant";
import { FileAttachmentsList, FileAttachmentsUploader } from "@/components/file-attachments";
import { HomeworkSubmissionsModal } from "@/components/homework-submissions-modal";
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
  const [attachments, setAttachments] = React.useState<HomeworkAttachment[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [selectedHwForSubmissions, setSelectedHwForSubmissions] = React.useState<KabinetHomeworkItem | null>(null);

  function resetForm() {
    setCustomGroupId(null);
    setLessonDate(today);
    setTitle("");
    setDescription("");
    setDueDate("");
    setAttachments([]);
    setOpen(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveGroupId) {
      toast({ tone: "danger", title: uz.homework.guruhniTanlang });
      return;
    }
    if (!title.trim()) {
      toast({ tone: "danger", title: uz.homework.topshiriqMavzusiSarlavhasiniKiriting });
      return;
    }

    startTransition(async () => {
      const res = await createGroupHomeworkAction({
        groupId: effectiveGroupId,
        lessonDate,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        attachments,
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
          <p className="text-body text-muted-foreground">{uz.homework.barchaGuruhlaringizgaBerilganTopshiriqlar}</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!groups.length}>
          <Plus /> {t.homeworkAdd}
        </Button>
      </div>

      {/* Guruhlar bo'yicha filtr */}
      {groups.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/kabinet/uy-ishi"
            className={`px-3 py-1.5 text-caption font-semibold rounded-control transition-colors ${
              !selectedGroupId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Hammasi ({homeworks.length})
          </Link>
          {groups.map((g) => {
            const count = homeworks.filter((h) => h.groupId === g.id).length;
            const active = selectedGroupId === g.id;
            return (
              <Link
                key={g.id}
                href={`/kabinet/uy-ishi?groupId=${g.id}`}
                className={`px-3 py-1.5 text-caption font-semibold rounded-control transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {g.name} ({count})
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Vazifalar ro'yxati */}
      {homeworks.length > 0 ? (
        <div className="space-y-4">
          {homeworks.map((hw) => (
            <Card key={hw.id} className="p-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-primary">{hw.groupName}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-caption text-muted-foreground">{hw.courseName}</span>
                  </div>
                  <h2 className="text-subheading font-bold text-foreground mt-0.5">{hw.title}</h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelectedHwForSubmissions(hw)}
                  >
                    <Inbox className="size-4 text-primary" />
                    <span>Javoblar ({hw.submissionsCount})</span>
                    {hw.checkedCount > 0 ? (
                      <Badge tone="success" className="ml-1 text-xs py-0 px-1.5">
                        {hw.checkedCount} ta tekshirildi
                      </Badge>
                    ) : hw.submissionsCount > 0 ? (
                      <Badge tone="warning" className="ml-1 text-xs py-0 px-1.5">
                        kutilmoqda
                      </Badge>
                    ) : null}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive-text"
                    disabled={deletingId === hw.id}
                    onClick={() => handleDelete(hw.id, hw.groupId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {hw.description ? (
                <div className="p-3.5 rounded-control bg-muted/40 border border-border-soft text-body text-foreground whitespace-pre-wrap">
                  {hw.description}
                </div>
              ) : null}

              {/* Biriktirilgan fayllar */}
              {hw.attachments && hw.attachments.length > 0 ? (
                <FileAttachmentsList attachments={hw.attachments} className="pt-1" />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border-soft text-caption text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> Dars sanasi: <b>{formatDate(hw.lessonDate)}</b>
                  </span>
                  {hw.dueDate ? (
                    <span className="flex items-center gap-1.5 text-warning font-semibold">
                      <Clock className="size-3.5" /> Muddat: {formatDate(hw.dueDate)}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <span>Berildi: {formatDate(new Date(hw.createdAt).toISOString().slice(0, 10))}</span>
                  <Link
                    href={`/kabinet/guruhlar/${hw.groupId}?tab=homework`}
                    className="text-primary hover:underline font-sans font-semibold"
                  >
                    {uz.homework.guruhgaOtish}
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title={selectedGroupId ? uz.homework.ushbuGuruhgaHaliUy : t.homeworkEmpty}
          description={uz.homework.yangiTopshiriqBerishUchun}
          action={
            <Button onClick={() => setOpen(true)} disabled={!groups.length} size="sm">
              <Plus /> {t.homeworkAdd}
            </Button>
          }
        />
      )}

      {/* O'quvchilar topshiriqlarini tekshirish modali */}
      <HomeworkSubmissionsModal
        open={!!selectedHwForSubmissions}
        onOpenChange={(v) => {
          if (!v) setSelectedHwForSubmissions(null);
        }}
        homeworkId={selectedHwForSubmissions?.id ?? null}
        homeworkTitle={selectedHwForSubmissions?.title ?? ""}
        onUpdated={() => router.refresh()}
      />

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
            <Label htmlFor="hw-group-select">{uz.homework.guruhniTanlang}</Label>
            <Select value={effectiveGroupId} onValueChange={setCustomGroupId}>
              <SelectTrigger id="hw-group-select" className="w-full">
                <SelectValue placeholder={uz.homework.guruhniTanlang} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.courseName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <FieldHint>{uz.homework.ixtiyoriy}</FieldHint>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hw-page-title">{t.homeworkTaskTitle}</Label>
            <Input
              id="hw-page-title"
              placeholder={uz.homework.masalan4MavzuMashqlari}
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
              placeholder={uz.homework.topshiriqShartlariVaQoshimcha}
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldHint>{uz.homework.oquvchilarUshbuTavsifniOz}</FieldHint>
          </div>

          {/* Fayllar va materiallar biriktirish */}
          <div className="space-y-1.5 pt-1">
            <Label>{uz.homework.topshiriqMateriallariVaFayllar}</Label>
            <FileAttachmentsUploader
              attachments={attachments}
              onChange={setAttachments}
              disabled={pending}
              label={uz.homework.faylYokiKitobBiriktirish}
            />
            <FieldHint>{uz.homework.darslikMashqlarToplamiYoki}</FieldHint>
          </div>
        </form>
      </Modal>
    </div>
  );
}

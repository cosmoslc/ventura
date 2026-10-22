"use client";

import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { HomeworkAttachment } from "@ventura/db/schema/tenant";
import { FileAttachmentsList, FileAttachmentsUploader } from "@/components/file-attachments";
import { formatDate } from "@/lib/format";
import type { PortalHomeworkItem } from "@/lib/server/portal";
import { submitHomeworkAction } from "./actions";

/**
 * O'quvchi uy vazifalari sahifasi (ADR 0063).
 * O'qituvchi tashlagan vazifalar, fayllar va o'quvchining javob yuborishi.
 * Muallif / Agent: Google Gemini
 */
export function PortalHomeworkView({ items }: { items: PortalHomeworkItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | "pending" | "done" | "undone">("all");

  // Reply / Topshiriq yuborish modal holati
  const [replyingHw, setReplyingHw] = React.useState<PortalHomeworkItem | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [attachments, setAttachments] = React.useState<HomeworkAttachment[]>([]);
  const [submitting, startTransition] = React.useTransition();

  function openReplyModal(hw: PortalHomeworkItem) {
    setReplyingHw(hw);
    setReplyText(hw.submission?.text ?? "");
    setAttachments(hw.submission?.attachments ?? []);
  }

  function closeReplyModal() {
    setReplyingHw(null);
    setReplyText("");
    setAttachments([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replyingHw) return;
    if (!replyText.trim() && attachments.length === 0) {
      toast({ tone: "danger", title: "Javob matni yoki kamida bitta fayl yuklang" });
      return;
    }

    startTransition(async () => {
      const res = await submitHomeworkAction({
        homeworkId: replyingHw.id,
        text: replyText.trim() || undefined,
        attachments,
      });

      if (!res.ok) {
        toast({ tone: "danger", title: res.error || "Topshiriqni yuborib bo'lmadi" });
        return;
      }

      toast({ tone: "success", title: "Topshiriq muvaffaqiyatli yuborildi!" });
      closeReplyModal();
      router.refresh();
    });
  }

  const visible = items.filter((h) => {
    if (filter === "all") return true;
    return h.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-title text-foreground">Uy vazifalari</h1>
          <p className="text-body text-muted-foreground">
            O'qituvchilaringiz tomonidan berilgan topshiriqlar va javoblarni yuborish
          </p>
        </div>

        {/* Filtr tugmalari */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-control self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Hammasi ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "pending" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kutilmoqda ({items.filter((i) => i.status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("done")}
            className={`px-3 py-1 text-caption font-semibold rounded-control transition-colors ${
              filter === "done" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bajarildi ({items.filter((i) => i.status === "done").length})
          </button>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-4">
          {visible.map((h) => {
            const hasSub = !!h.submission;
            const sub = h.submission;
            const isChecked = sub?.status === "checked";
            const isRejected = sub?.status === "rejected";

            return (
              <Card key={h.id} className="p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-semibold text-primary">{h.groupName}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-caption text-muted-foreground">{h.courseName}</span>
                    </div>
                    <h2 className="text-subheading font-bold text-foreground mt-0.5">{h.title}</h2>
                  </div>

                  <div className="self-start sm:self-auto shrink-0">
                    {isChecked ? (
                      <Badge tone="success" className="gap-1 font-bold">
                        <CheckCircle2 className="size-3.5" /> Baholandi {sub.grade ? `(${sub.grade})` : ""}
                      </Badge>
                    ) : isRejected ? (
                      <Badge tone="danger" className="gap-1">
                        <XCircle className="size-3.5" /> Qaytarildi
                      </Badge>
                    ) : hasSub ? (
                      <Badge tone="warning" className="gap-1">
                        <Clock className="size-3.5" /> Tekshirilmoqda
                      </Badge>
                    ) : (
                      <Badge tone="neutral" className="gap-1">
                        <Clock className="size-3.5" /> Kutilmoqda
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Vazifa tavsifi */}
                {h.description ? (
                  <div className="p-3.5 rounded-control bg-muted/40 border border-border-soft text-body text-foreground whitespace-pre-wrap">
                    {h.description}
                  </div>
                ) : null}

                {/* O'qituvchi biriktirgan fayllar */}
                {h.attachments && h.attachments.length > 0 ? (
                  <FileAttachmentsList attachments={h.attachments} className="pt-1" />
                ) : null}

                {/* O'quvchining yuborgan javobi / O'qituvchi tekshiruvi natijasi */}
                {sub ? (
                  <div
                    className={`p-4 rounded-card border space-y-2.5 transition-all ${
                      isChecked
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : isRejected
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border-soft bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-bold text-foreground flex items-center gap-1.5">
                        {isChecked ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : isRejected ? (
                          <XCircle className="size-4 text-red-500" />
                        ) : (
                          <Clock className="size-4 text-amber-500" />
                        )}
                        {isChecked
                          ? "O'qituvchi tekshirdi va baholadi"
                          : isRejected
                            ? "Topshiriq qaytarildi"
                            : "Siz topshirgan javob"}
                      </span>

                      {!isChecked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => openReplyModal(h)}
                        >
                          <RotateCcw className="size-3" /> Qayta yuborish
                        </Button>
                      ) : null}
                    </div>

                    {/* Baho va o'qituvchi sharhi */}
                    {isChecked ? (
                      <div className="p-3 rounded-control bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                        {sub.grade ? (
                          <div className="text-body font-bold text-emerald-700 dark:text-emerald-400">
                            Qo'yilgan baho: {sub.grade}
                          </div>
                        ) : null}
                        {sub.feedback ? (
                          <p className="text-body text-foreground">
                            <span className="font-semibold text-muted-foreground">O'qituvchi izohi: </span>
                            {sub.feedback}
                          </p>
                        ) : null}
                      </div>
                    ) : isRejected && sub.feedback ? (
                      <div className="p-3 rounded-control bg-red-500/10 border border-red-500/20 text-body text-red-700 dark:text-red-400">
                        <span className="font-semibold">Sabab: </span>
                        {sub.feedback}
                      </div>
                    ) : null}

                    {/* O'quvchining matni va fayllari */}
                    {sub.text ? (
                      <p className="text-body text-foreground whitespace-pre-wrap">
                        <span className="text-caption font-semibold text-muted-foreground block">
                          Sizning javobingiz:
                        </span>
                        {sub.text}
                      </p>
                    ) : null}

                    {sub.attachments && sub.attachments.length > 0 ? (
                      <FileAttachmentsList attachments={sub.attachments} />
                    ) : null}

                    <div className="text-2xs text-muted-foreground font-mono pt-1">
                      Yuborilgan vaqti: {formatDate(sub.submittedAt.slice(0, 10))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-control border border-dashed border-border-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card">
                    <span className="text-caption text-muted-foreground">
                      Ushbu vazifaga hali javob yoki fayl topshirmagansiz
                    </span>
                    <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => openReplyModal(h)}>
                      <Upload className="size-3.5" /> Javob topshirish
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border-soft text-caption text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" /> Dars:{" "}
                      <strong className="text-foreground">{formatDate(h.lessonDate)}</strong>
                    </span>
                    {h.dueDate ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-warning" /> Muddat:{" "}
                        <strong className="text-foreground">{formatDate(h.dueDate)}</strong>
                      </span>
                    ) : null}
                  </div>

                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5" /> O'qituvchi: {h.teacherName}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <BookOpen className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-body font-bold text-foreground">Topshiriqlar mavjud emas</h3>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Hozircha sizga biriktirilgan yangi uy vazifalari yo'q.
          </p>
        </Card>
      )}

      {/* Vazifaga javob topshirish modali */}
      <Modal
        open={!!replyingHw}
        onOpenChange={(v) => {
          if (!v) closeReplyModal();
        }}
        position="center"
        title="Vazifani topshirish"
        description={replyingHw?.title ?? ""}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeReplyModal} disabled={submitting}>
              Bekor qilish
            </Button>
            <Button form="submit-hw-form" type="submit" disabled={submitting}>
              {submitting ? "Yuborilmoqda..." : "Topshirish"}
            </Button>
          </>
        }
      >
        <form id="submit-hw-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reply-text">Javob matni yoki izohingiz</Label>
            <Textarea
              id="reply-text"
              placeholder="Vazifa bo'yicha javobingiz, yechimlar yoki o'qituvchiga izoh..."
              rows={4}
              maxLength={2000}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fayllar va daftaringiz fotosuratlari</Label>
            <FileAttachmentsUploader
              attachments={attachments}
              onChange={setAttachments}
              disabled={submitting}
              label="📎 Rasm yoki fayl yuklash"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

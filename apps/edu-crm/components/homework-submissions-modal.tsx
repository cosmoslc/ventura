"use client";

import { CheckCircle2, Clock, RotateCcw, User, XCircle } from "lucide-react";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { checkHomeworkSubmissionAction, getHomeworkSubmissionsAction } from "@/app/(kabinet)/kabinet/actions";
import { FileAttachmentsList } from "@/components/file-attachments";
import type { HomeworkSubmissionItem } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";

/*
 * O'qituvchi uchun o'quvchilar topshirgan uy vazifalarini ko'rish va baholash modali.
 * Muallif / Agent: Google Gemini
 */
export function HomeworkSubmissionsModal({
  open,
  onOpenChange,
  homeworkId,
  homeworkTitle,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeworkId: string | null;
  homeworkTitle: string;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [submissions, setSubmissions] = React.useState<HomeworkSubmissionItem[]>([]);
  const [checkingId, setCheckingId] = React.useState<string | null>(null);
  const [gradeInput, setGradeInput] = React.useState<Record<string, string>>({});
  const [feedbackInput, setFeedbackInput] = React.useState<Record<string, string>>({});

  const reloadData = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await getHomeworkSubmissionsAction(id);
      if (res.ok && Array.isArray(res.data)) {
        const items = res.data as HomeworkSubmissionItem[];
        setSubmissions(items);
        const grades: Record<string, string> = {};
        const feedbacks: Record<string, string> = {};
        for (const item of items) {
          if (item.grade !== null) grades[item.id] = String(item.grade);
          if (item.feedback) feedbacks[item.id] = item.feedback;
        }
        setGradeInput(grades);
        setFeedbackInput(feedbacks);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    if (open && homeworkId) {
      void getHomeworkSubmissionsAction(homeworkId).then((res) => {
        if (!active) return;
        if (res.ok && Array.isArray(res.data)) {
          const items = res.data as HomeworkSubmissionItem[];
          setSubmissions(items);
          const grades: Record<string, string> = {};
          const feedbacks: Record<string, string> = {};
          for (const item of items) {
            if (item.grade !== null) grades[item.id] = String(item.grade);
            if (item.feedback) feedbacks[item.id] = item.feedback;
          }
          setGradeInput(grades);
          setFeedbackInput(feedbacks);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, homeworkId]);

  async function handleCheck(submissionId: string, status: "checked" | "rejected") {
    setCheckingId(submissionId);
    const rawGrade = gradeInput[submissionId]?.trim();
    const grade = rawGrade ? parseInt(rawGrade, 10) : undefined;
    const feedback = feedbackInput[submissionId]?.trim();

    try {
      const res = await checkHomeworkSubmissionAction({
        submissionId,
        grade,
        feedback,
        status,
      });

      if (!res.ok) {
        toast({ tone: "danger", title: res.error || uz.homework.saqlabBolmadi });
        return;
      }

      toast({
        tone: "success",
        title: status === "checked" ? uz.homework.checkedToast : uz.homework.returnedToast,
      });

      if (homeworkId) void reloadData(homeworkId);
      onUpdated?.();
    } catch {
      toast({ tone: "danger", title: uz.homework.amalniBajaribBolmadi });
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={uz.homework.submissionsTitle(homeworkTitle)}
      description={uz.homework.oquvchilarYuborganFayllarVa}
      position="center"
      wide
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-body text-muted-foreground animate-pulse">
            {uz.homework.oquvchilarTopshiriqlariYuklanmoqda}
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Clock className="size-10 text-muted-foreground/60 mx-auto" />
            <p className="text-body font-semibold text-foreground">Hozircha hech kim topshiriq yubormagan</p>
            <p className="text-caption text-muted-foreground max-w-sm mx-auto">
              {uz.homework.oquvchilarOzPortaliOrqali}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => {
              const isChecking = checkingId === s.id;
              const isChecked = s.status === "checked";
              const isRejected = s.status === "rejected";

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-card border transition-all ${
                    isChecked
                      ? "border-(--success-border) bg-(--success-bg)"
                      : isRejected
                        ? "border-(--danger-border) bg-(--danger-bg)"
                        : "border-border-soft bg-card shadow-xs"
                  }`}
                >
                  {/* Sarlavha: O'quvchi ismi va holati */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border-soft">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-caption shrink-0">
                        <User className="size-4" />
                      </div>
                      <div>
                        <div className="text-body font-bold text-foreground">{s.studentName}</div>
                        <div className="text-caption text-muted-foreground font-mono">{s.studentPhone}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <Badge tone="success" className="gap-1">
                          <CheckCircle2 className="size-3.5" /> Tekshirildi {s.grade ? `(${s.grade})` : ""}
                        </Badge>
                      ) : isRejected ? (
                        <Badge tone="danger" className="gap-1">
                          <XCircle className="size-3.5" /> Qaytarildi
                        </Badge>
                      ) : (
                        <Badge tone="warning" className="gap-1">
                          <Clock className="size-3.5" /> Yangi topshirilgan
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* O'quvchi javobi */}
                  <div className="py-3 space-y-2">
                    {s.text ? (
                      <div className="p-3 rounded-control bg-muted/40 border border-border-soft text-body text-foreground whitespace-pre-wrap">
                        <span className="text-caption font-semibold text-muted-foreground block mb-1">
                          💬 O'quvchi izohi:
                        </span>
                        {s.text}
                      </div>
                    ) : null}

                    {/* O'quvchi yuborgan fayllar */}
                    {s.attachments && s.attachments.length > 0 ? (
                      <FileAttachmentsList attachments={s.attachments} />
                    ) : null}
                  </div>

                  {/* O'qituvchi baholash shakli */}
                  <div className="pt-3 border-t border-border-soft space-y-3 bg-muted/20 p-3 rounded-control">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="sm:col-span-1">
                        <Label htmlFor={`grade-${s.id}`}>{uz.homework.baho1100Yoki}</Label>
                        <Input
                          id={`grade-${s.id}`}
                          type="number"
                          min={1}
                          max={100}
                          placeholder={uz.homework.baho}
                          value={gradeInput[s.id] ?? ""}
                          onChange={(e) => setGradeInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          disabled={isChecking}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label htmlFor={`feedback-${s.id}`}>{uz.homework.izohSharhOquvchigaKorinadi}</Label>
                        <Input
                          id={`feedback-${s.id}`}
                          placeholder={uz.homework.masalanBarakallaXatolarniTogirlang}
                          value={feedbackInput[s.id] ?? ""}
                          onChange={(e) => setFeedbackInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          disabled={isChecking}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive-text"
                        disabled={isChecking}
                        onClick={() => handleCheck(s.id, "rejected")}
                      >
                        <RotateCcw className="size-3.5" /> Qaytarish
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={isChecking}
                        onClick={() => handleCheck(s.id, "checked")}
                      >
                        <CheckCircle2 className="size-4" />
                        {isChecked ? uz.homework.qaytaBaholash : uz.homework.tekshirildiVaBaholash}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

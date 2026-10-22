"use client";

import { Download, File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Paperclip, X } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { toast } from "@ventura/ui/toast";
import type { HomeworkAttachment } from "@ventura/db/schema/tenant";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return <FileImage className="size-4 shrink-0 text-amber-500" />;
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
      return <FileText className="size-4 shrink-0 text-blue-500" />;
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="size-4 shrink-0 text-emerald-500" />;
    case "zip":
    case "rar":
      return <FileArchive className="size-4 shrink-0 text-purple-500" />;
    case "mp3":
    case "wav":
      return <FileAudio className="size-4 shrink-0 text-pink-500" />;
    case "mp4":
      return <FileVideo className="size-4 shrink-0 text-red-500" />;
    default:
      return <File className="size-4 shrink-0 text-muted-foreground" />;
  }
}

/** Fayl yuklash va biriktirish komponenti */
export function FileAttachmentsUploader({
  attachments,
  onChange,
  disabled,
  label = "📎 Fayl biriktirish",
}: {
  attachments: HomeworkAttachment[];
  onChange: (items: HomeworkAttachment[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;

    setUploading(true);
    const newItems: HomeworkAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        toast({ tone: "danger", title: `${file.name}: Fayl hajmi 25 MB dan oshmasligi kerak` });
        continue;
      }

      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (data.ok && data.file) {
          newItems.push(data.file);
        } else {
          toast({ tone: "danger", title: data.error || "Fayl yuklashda xatolik" });
        }
      } catch {
        toast({ tone: "danger", title: `${file.name}: Yuklab bo'lmadi` });
      }
    }

    if (newItems.length > 0) {
      onChange([...attachments, ...newItems]);
      toast({ tone: "success", title: `${newItems.length} ta fayl yuklandi` });
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(id: string) {
    onChange(attachments.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="subtle"
          size="sm"
          className="gap-1.5"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {uploading ? "Yuklanmoqda..." : label}
        </Button>
        <span className="text-caption text-muted-foreground">PDF, Word, Excel, rasm yoki audio (25 MB gacha)</span>
      </div>

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-control bg-muted/60 border border-border-soft text-caption text-foreground max-w-full"
            >
              {getFileIcon(file.name)}
              <span className="truncate max-w-[180px] sm:max-w-[240px] font-medium" title={file.name}>
                {file.name}
              </span>
              <span className="text-muted-foreground text-xs font-mono">{formatFileSize(file.size)}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => handleRemove(file.id)}
                  className="text-muted-foreground hover:text-destructive-text p-0.5 rounded transition-colors ml-1"
                  title="O'chirish"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Biriktirilgan fayllarni ko'rish va yuklab olish ro'yxati */
export function FileAttachmentsList({
  attachments,
  className = "",
}: {
  attachments: HomeworkAttachment[];
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="text-caption font-semibold text-muted-foreground block">
        📎 Biriktirilgan materiallar ({attachments.length}):
      </span>
      <div className="flex flex-wrap gap-2">
        {attachments.map((file) => (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            download={file.name}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-control bg-card hover:bg-muted/80 border border-border-soft text-caption text-foreground transition-all group shadow-xs"
          >
            {getFileIcon(file.name)}
            <span className="truncate max-w-[180px] sm:max-w-[260px] font-medium group-hover:text-primary transition-colors" title={file.name}>
              {file.name}
            </span>
            <span className="text-muted-foreground text-xs font-mono">{formatFileSize(file.size)}</span>
            <Download className="size-3.5 text-muted-foreground group-hover:text-primary ml-1 shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}

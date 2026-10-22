"use client";

import {
  AlertTriangle,
  BookOpen,
  Clock,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  GraduationCap,
  HardDrive,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { cn } from "@ventura/ui/lib/utils";
import type { CleanupFilter, StorageFileRecord, StorageStats } from "@/lib/server/storage";
import {
  deleteSingleFileAction,
  executeCleanupAction,
  getCleanupEstimateAction,
} from "./actions";

/*
 * Xotira va fayllar sahifasi (Storage Page).
 * Muallif / Agent: Google Gemini
 */

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function getFileIcon(mime: string, name: string) {
  const lower = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(lower)) {
    return <FileImage className="size-4 text-emerald-500 shrink-0" />;
  }
  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    return <FileText className="size-4 text-rose-500 shrink-0" />;
  }
  if (mime.includes("excel") || mime.includes("spreadsheet") || /\.(xls|xlsx|csv)$/.test(lower)) {
    return <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />;
  }
  if (mime.includes("word") || /\.(doc|docx)$/.test(lower)) {
    return <FileText className="size-4 text-blue-500 shrink-0" />;
  }
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar") || /\.(zip|rar|tar|gz|7z)$/.test(lower)) {
    return <FileArchive className="size-4 text-amber-500 shrink-0" />;
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(lower)) {
    return <FileAudio className="size-4 text-purple-500 shrink-0" />;
  }
  return <FileCode className="size-4 text-muted-foreground shrink-0" />;
}

interface StorageViewProps {
  initialStats: StorageStats;
  canManage: boolean;
}

export function StorageView({ initialStats, canManage }: StorageViewProps) {
  const [stats] = React.useState<StorageStats>(initialStats);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  // Tozalash modali holati
  const [activeFilter, setActiveFilter] = React.useState<CleanupFilter | null>(null);
  const [estimate, setEstimate] = React.useState<{ filesCount: number; bytes: number; label: string } | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);

  // Bitta faylni o'chirish modali
  const [fileToDelete, setFileToDelete] = React.useState<StorageFileRecord | null>(null);
  const [deletingSingle, setDeletingSingle] = React.useState(false);

  const openCleanupModal = async (filter: CleanupFilter) => {
    setActiveFilter(filter);
    setEstimating(true);
    setEstimate(null);
    try {
      const res = await getCleanupEstimateAction(filter);
      if (res.ok) {
        setEstimate({ filesCount: res.filesCount, bytes: res.bytes, label: res.label });
      } else {
        toast({ tone: "danger", title: res.error || "Taxminiy ma'lumotni hisoblab bo'lmadi" });
        setActiveFilter(null);
      }
    } catch {
      toast({ tone: "danger", title: "Hisoblashda xatolik yuz berdi" });
      setActiveFilter(null);
    } finally {
      setEstimating(false);
    }
  };

  const handleConfirmCleanup = async () => {
    if (!activeFilter) return;
    setCleaning(true);
    try {
      const res = await executeCleanupAction(activeFilter);
      if (res.ok) {
        toast({
          tone: "success",
          title: "Xotira tozalandi",
          description: `${res.filesDeleted} ta fayl o'chirildi, ${formatBytes(res.bytesFreed)} joy bo'shatildi.`,
        });
        setActiveFilter(null);
        window.location.reload();
      } else {
        toast({ tone: "danger", title: res.error || "Tozalashda xatolik" });
      }
    } catch {
      toast({ tone: "danger", title: "Tozalash bajarilmadi" });
    } finally {
      setCleaning(false);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!fileToDelete) return;
    setDeletingSingle(true);
    try {
      const res = await deleteSingleFileAction(fileToDelete.url);
      if (res.ok) {
        toast({ tone: "success", title: "Fayl o'chirildi" });
        setFileToDelete(null);
        window.location.reload();
      } else {
        toast({ tone: "danger", title: res.error || "O'chirishda xatolik" });
      }
    } catch {
      toast({ tone: "danger", title: "Fayl o'chirilmadi" });
    } finally {
      setDeletingSingle(false);
    }
  };

  // Filtrlangan fayllar ro'yxati
  const filteredFiles = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return stats.recentFiles.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.sourceTitle.toLowerCase().includes(q);
    });
  }, [stats.recentFiles, search, categoryFilter]);

  // Rang ko'rsatkichi
  const percent = stats.percentUsed;
  const barColor = percent >= 90 ? "bg-rose-500" : percent >= 75 ? "bg-amber-500" : "bg-primary";
  const isDanger = percent >= 90;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-2xl font-bold text-foreground">Xotira va fayllar</h1>
          <p className="text-body text-muted-foreground">
            Boshqaruv paneli (Control Panel) tomonidan berilgan xotira limiti, ishlatilishi va fayllarni tozalash.
          </p>
        </div>
        <Button variant="subtle" onClick={() => window.location.reload()} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="size-4" />
          Yangilash
        </Button>
      </div>

      {/* Asosiy Xotira Holati (Limit va Progress) */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HardDrive className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="type-heading text-xl font-bold text-foreground">{formatBytes(stats.usedBytes)}</span>
                <span className="text-body text-muted-foreground font-normal">/ {formatMb(stats.limitMb)}</span>
              </div>
              <p className="text-caption text-muted-foreground">
                Ajratilgan xotira: <span className="font-semibold text-foreground">{formatMb(stats.limitMb)}</span>{" "}
                (Boshqaruv paneli bo&apos;yicha)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={isDanger ? "danger" : percent >= 75 ? "warning" : "success"} dot>
              {percent}% to&apos;lgan
            </Badge>
            <span className="text-caption font-medium text-muted-foreground">
              Bo&apos;sh joy: {formatBytes(stats.freeBytes)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all duration-500 rounded-full", barColor)}
              style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
            />
          </div>
        </div>

        {isDanger && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-caption text-rose-600 dark:text-rose-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Diqqat! Markaz xotirasi 90% dan oshdi. Yangi fayllarni yuklash to&apos;xtab qolmasligi uchun eski
              fayllarni tozalang yoki limitni oshiring.
            </span>
          </div>
        )}
      </div>

      {/* Toifalar bo'yicha taqsimot */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">O&apos;qituvchi vazifalari</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <BookOpen className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {formatBytes(stats.categories.homeworkTeacher.bytes)}
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            {stats.categories.homeworkTeacher.filesCount} ta material va konspekt
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">O&apos;quvchilar javoblari</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <GraduationCap className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {formatBytes(stats.categories.homeworkSubmissions.bytes)}
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            {stats.categories.homeworkSubmissions.filesCount} ta o&apos;quvchi topshirig&apos;i
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">Boshqa va yetim fayllar</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
              <FolderArchive className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">{formatBytes(stats.categories.other.bytes)}</div>
          <p className="mt-1 text-caption text-muted-foreground">{stats.categories.other.filesCount} ta fayl</p>
        </div>
      </div>

      {/* Xotirani Tezkor Tozalash Bloki */}
      {canManage && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="type-heading text-lg font-bold text-foreground">Xotirani tozalash</h2>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            Eski o&apos;quv davrlari, topshirilgan javoblar va foydalanilmayotgan fayllarni bir tugma bilan o&apos;chirib,
            diskda bo&apos;sh joy yarating.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              variant="subtle"
              onClick={() => openCleanupModal("1m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />
              1 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("3m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive font-semibold"
            >
              <Trash2 className="size-4 text-amber-500" />
              3 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("4m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />
              4 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("6m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />
              6 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("all_submissions")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <GraduationCap className="size-4 text-muted-foreground" />
              Faqat o&apos;quvchi javoblarini tozalash
            </Button>

            {stats.categories.other.filesCount > 0 && (
              <Button
                variant="subtle"
                onClick={() => openCleanupModal("orphans")}
                className="gap-2 border border-border hover:border-destructive hover:text-destructive"
              >
                <FolderArchive className="size-4 text-muted-foreground" />
                Yetim fayllarni tozalash ({stats.categories.other.filesCount})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Fayllar ro'yxati (Explorer) */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-heading text-lg font-bold text-foreground">Fayllar ro&apos;yxati</h2>
            <p className="text-caption text-muted-foreground">Jami {stats.totalFiles} ta fayl saqlanmoqda</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Kategoriya filtri */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-caption">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  categoryFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                Barchasi
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("homework_teacher")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  categoryFilter === "homework_teacher" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                Vazifalar
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("homework_submission")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  categoryFilter === "homework_submission"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground",
                )}
              >
                Javoblar
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("other")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  categoryFilter === "other" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                Boshqa
              </button>
            </div>

            {/* Qidiruv */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Fayl nomi..."
                className="h-9 w-full rounded-control border border-border bg-card pl-8 pr-3 text-caption outline-none focus:border-primary sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Jadval */}
        <div className="mt-4 overflow-x-auto">
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-body text-muted-foreground">Fayllar topilmadi</div>
          ) : (
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-border text-caption text-muted-foreground">
                  <th className="pb-3 font-semibold">Fayl</th>
                  <th className="pb-3 font-semibold">Manba</th>
                  <th className="pb-3 font-semibold">Hajmi</th>
                  <th className="pb-3 font-semibold">Yuklangan vaqti</th>
                  {canManage && <th className="pb-3 text-right font-semibold">Amal</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFiles.map((f) => (
                  <tr key={f.url} className="group hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(f.mimeType, f.name)}
                        <span className="max-w-[220px] truncate font-medium text-foreground sm:max-w-[340px]">
                          {f.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-caption text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          tone={
                            f.category === "homework_teacher"
                              ? "neutral"
                              : f.category === "homework_submission"
                                ? "success"
                                : "warning"
                          }
                        >
                          {f.category === "homework_teacher"
                            ? "Vazifa"
                            : f.category === "homework_submission"
                              ? "O'quvchi"
                              : "Boshqa"}
                        </Badge>
                        <span className="max-w-[180px] truncate">{f.sourceTitle}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-caption text-muted-foreground">{formatBytes(f.size)}</td>
                    <td className="py-3 pr-4 text-caption text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground/70" />
                        <span>{f.ageDays === 0 ? "Bugun" : `${f.ageDays} kun oldin`}</span>
                      </div>
                    </td>
                    {canManage && (
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex size-8 items-center justify-center rounded-control border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Ko'rish / Yuklab olish"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setFileToDelete(f)}
                            className="inline-flex size-8 items-center justify-center rounded-control border border-border text-muted-foreground hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="O'chirish"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tozalash Tasdiqlash Modali */}
      <Modal
        open={Boolean(activeFilter)}
        onOpenChange={(open) => {
          if (!open && !cleaning) setActiveFilter(null);
        }}
        position="center"
        title="Xotirani tozalashni tasdiqlang"
      >
        <div className="space-y-4">
          {estimating ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <RefreshCw className="size-5 animate-spin" />
              <span>O&apos;chiriladigan fayllar hisoblanmoqda...</span>
            </div>
          ) : estimate ? (
            <>
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-body text-destructive">
                <p className="font-semibold">{estimate.label}</p>
                <div className="mt-2 text-caption">
                  <p>
                    O&apos;chiriladigan fayllar soni:{" "}
                    <span className="font-bold text-foreground">{estimate.filesCount} ta</span>
                  </p>
                  <p>
                    Bo&apos;shaydigan hajm:{" "}
                    <span className="font-bold text-foreground">{formatBytes(estimate.bytes)}</span>
                  </p>
                </div>
              </div>

              <p className="text-body text-muted-foreground">
                Ushbu amal tanlangan barcha fayllarni server diskidan butunlay o&apos;chiradi va vazifalar/javoblar
                bog&apos;lamalarini tozalaydi. Ushbu amalni ortga qaytarib bo&apos;lmaydi.
              </p>
            </>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setActiveFilter(null)} disabled={cleaning}>
              Bekor qilish
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCleanup}
              disabled={cleaning || estimating || (estimate?.filesCount === 0)}
            >
              {cleaning ? "Tozalanmoqda..." : "Ha, o'chirilsin"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bitta faylni o'chirish modali */}
      <Modal
        open={Boolean(fileToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingSingle) setFileToDelete(null);
        }}
        position="center"
        title="Faylni o'chirish"
      >
        <div className="space-y-4">
          <p className="text-body text-foreground">
            Haqiqatan ham <strong className="text-foreground font-semibold">{fileToDelete?.name}</strong> faylini
            serverdan butunlay o&apos;chirmoqchimisiz?
          </p>
          <div className="rounded-lg bg-muted p-3 text-caption text-muted-foreground">
            Hajmi: {formatBytes(fileToDelete?.size || 0)} <br />
            Manba: {fileToDelete?.sourceTitle}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setFileToDelete(null)} disabled={deletingSingle}>
              Bekor qilish
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteSingle} disabled={deletingSingle}>
              {deletingSingle ? "O'chirilmoqda..." : "O'chirish"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

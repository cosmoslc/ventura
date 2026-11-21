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
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { FilterSearch } from "@ventura/ui/filter-bar";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@ventura/ui/table";
import { ViewSwitch } from "@ventura/ui/view-switch";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { cn } from "@ventura/ui/lib/utils";
import type { CleanupFilter, StorageFileRecord, StorageStats } from "@/lib/server/storage";
import { deleteSingleFileAction, executeCleanupAction, getCleanupEstimateAction } from "./actions";
import { uz } from "@/lib/uz";

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
    return <FileImage className="size-4 text-(--nav-hue-emerald) shrink-0" />;
  }
  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    return <FileText className="size-4 text-(--nav-hue-rose) shrink-0" />;
  }
  if (mime.includes("excel") || mime.includes("spreadsheet") || /\.(xls|xlsx|csv)$/.test(lower)) {
    return <FileSpreadsheet className="size-4 text-(--nav-hue-green) shrink-0" />;
  }
  if (mime.includes("word") || /\.(doc|docx)$/.test(lower)) {
    return <FileText className="size-4 text-(--nav-hue-blue) shrink-0" />;
  }
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar") || /\.(zip|rar|tar|gz|7z)$/.test(lower)) {
    return <FileArchive className="size-4 text-(--nav-hue-amber) shrink-0" />;
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(lower)) {
    return <FileAudio className="size-4 text-(--nav-hue-purple) shrink-0" />;
  }
  return <FileCode className="size-4 text-muted-foreground shrink-0" />;
}

interface StorageViewProps {
  initialStats: StorageStats;
  canManage: boolean;
}

type CategoryFilter = "all" | StorageFileRecord["category"];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "homework_teacher", label: "Vazifalar" },
  { value: "homework_submission", label: "Javoblar" },
  { value: "other", label: "Boshqa" },
] as const satisfies readonly { value: CategoryFilter; label: string }[];

export function StorageView({ initialStats, canManage }: StorageViewProps) {
  const [stats] = React.useState<StorageStats>(initialStats);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all");

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
        toast({ tone: "danger", title: res.error || uz.storage.taxminiyMalumotniHisoblabBolmadi });
        setActiveFilter(null);
      }
    } catch {
      toast({ tone: "danger", title: uz.storage.hisoblashdaXatolikYuzBerdi });
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
          title: uz.storage.xotiraTozalandi,
          description: uz.storage.cleaned(res.filesDeleted, formatBytes(res.bytesFreed)),
        });
        setActiveFilter(null);
        window.location.reload();
      } else {
        toast({ tone: "danger", title: res.error || uz.storage.tozalashdaXatolik });
      }
    } catch {
      toast({ tone: "danger", title: uz.storage.tozalashBajarilmadi });
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
        toast({ tone: "success", title: uz.storage.faylOchirildi });
        setFileToDelete(null);
        window.location.reload();
      } else {
        toast({ tone: "danger", title: res.error || uz.storage.ochirishdaXatolik });
      }
    } catch {
      toast({ tone: "danger", title: uz.storage.faylOchirilmadi });
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
  const barColor = percent >= 90 ? "bg-(--danger-fg)" : percent >= 75 ? "bg-(--warning-fg)" : "bg-primary";
  const isDanger = percent >= 90;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-heading text-2xl font-bold text-foreground">Xotira va fayllar</h1>
          <p className="text-body text-muted-foreground">{uz.storage.boshqaruvPaneliControlPanel}</p>
        </div>
        <Button variant="subtle" onClick={() => window.location.reload()} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="size-4" />
          Yangilash
        </Button>
      </div>

      {/* Asosiy Xotira Holati (Limit va Progress) */}
      <div className="rounded-card border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-card bg-primary/10 text-primary">
              <HardDrive className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="type-heading text-xl font-bold text-foreground">{formatBytes(stats.usedBytes)}</span>
                <span className="text-body text-muted-foreground font-normal">/ {formatMb(stats.limitMb)}</span>
              </div>
              <p className="text-caption text-muted-foreground">
                {uz.storage.allocated}: <span className="font-semibold text-foreground">{formatMb(stats.limitMb)}</span>{" "}
                {uz.storage.byPanel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={isDanger ? "danger" : percent >= 75 ? "warning" : "success"} dot>
              {uz.storage.percentFull(percent)}
            </Badge>
            <span className="text-caption font-medium text-muted-foreground">
              {uz.storage.freeSpace}: {formatBytes(stats.freeBytes)}
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
          <div className="mt-4 flex items-center gap-2 rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-caption text-(--danger-fg)">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{uz.storage.almostFull}</span>
          </div>
        )}
      </div>

      {/* Toifalar bo'yicha taqsimot */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">{uz.storage.teacherFiles}</span>
            <div className="rounded-control bg-(--info-bg) p-2 text-(--info-fg)">
              <BookOpen className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {formatBytes(stats.categories.homeworkTeacher.bytes)}
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            {uz.storage.teacherFilesCount(stats.categories.homeworkTeacher.filesCount)}
          </p>
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">{uz.storage.studentFiles}</span>
            <div className="rounded-control bg-(--success-bg) p-2 text-(--success-fg)">
              <GraduationCap className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {formatBytes(stats.categories.homeworkSubmissions.bytes)}
          </div>
          <p className="mt-1 text-caption text-muted-foreground">
            {uz.storage.studentFilesCount(stats.categories.homeworkSubmissions.filesCount)}
          </p>
        </div>

        <div className="rounded-card border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">{uz.storage.otherFiles}</span>
            <div className="rounded-control bg-(--neutral-bg) p-2 text-(--nav-hue-purple)">
              <FolderArchive className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">{formatBytes(stats.categories.other.bytes)}</div>
          <p className="mt-1 text-caption text-muted-foreground">
            {uz.storage.filesCount(stats.categories.other.filesCount)}
          </p>
        </div>
      </div>

      {/* Xotirani Tezkor Tozalash Bloki */}
      {canManage && (
        <div className="rounded-card border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="type-heading text-lg font-bold text-foreground">{uz.storage.cleanupTitle}</h2>
          </div>
          <p className="mt-1 text-body text-muted-foreground">{uz.storage.cleanupHint}</p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              variant="subtle"
              onClick={() => openCleanupModal("1m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />1 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("3m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive font-semibold"
            >
              <Trash2 className="size-4 text-(--warning-fg)" />3 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("4m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />4 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("6m")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="size-4 text-muted-foreground" />6 oydan eski fayllarni tozalash
            </Button>

            <Button
              variant="subtle"
              onClick={() => openCleanupModal("all_submissions")}
              className="gap-2 border border-border hover:border-destructive hover:text-destructive"
            >
              <GraduationCap className="size-4 text-muted-foreground" />
              {uz.storage.cleanupSubmissions}
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
      <div className="rounded-card border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-heading text-lg font-bold text-foreground">Fayllar ro&apos;yxati</h2>
            <p className="text-caption text-muted-foreground">Jami {stats.totalFiles} ta fayl saqlanmoqda</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ViewSwitch
              aria-label={uz.storage.faylTuri}
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={CATEGORY_OPTIONS}
            />
            <FilterSearch
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={uz.storage.faylNomi}
              className="sm:w-48"
            />
          </div>
        </div>

        {/* Jadval */}
        <div className="mt-4 overflow-x-auto">
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-body text-muted-foreground">Fayllar topilmadi</div>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th>{uz.storage.fayl}</Th>
                    <Th>{uz.storage.manba}</Th>
                    <Th>{uz.storage.hajmi}</Th>
                    <Th>{uz.storage.yuklanganVaqti}</Th>
                    {canManage && <Th className="text-right">Amal</Th>}
                  </Tr>
                </THead>
                <TBody>
                  {filteredFiles.map((f) => (
                    <Tr key={f.url}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(f.mimeType, f.name)}
                          <span className="max-w-[220px] truncate font-medium text-foreground sm:max-w-[340px]">
                            {f.name}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-caption text-muted-foreground">
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
                      </Td>
                      <Td className="font-mono text-caption text-muted-foreground">{formatBytes(f.size)}</Td>
                      <Td className="text-caption text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground/70" />
                          <span>{f.ageDays === 0 ? uz.storage.today : uz.storage.daysAgo(f.ageDays)}</span>
                        </div>
                      </Td>
                      {canManage && (
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="icon" size="icon-sm" title={uz.storage.openFile}>
                              <a href={f.url} target="_blank" rel="noreferrer" aria-label={uz.storage.openFile}>
                                <ExternalLink />
                              </a>
                            </Button>
                            <Button
                              variant="icon"
                              size="icon-sm"
                              onClick={() => setFileToDelete(f)}
                              title={uz.storage.ochirish}
                              aria-label={uz.storage.ochirish}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
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
        title={uz.storage.xotiraniTozalashniTasdiqlang}
      >
        <div className="space-y-4">
          {estimating ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <RefreshCw className="size-5 animate-spin" />
              <span>{uz.storage.estimating}</span>
            </div>
          ) : estimate ? (
            <>
              <div className="rounded-card border border-destructive/20 bg-destructive/10 p-4 text-body text-destructive">
                <p className="font-semibold">{estimate.label}</p>
                <div className="mt-2 text-caption">
                  <p>
                    {uz.storage.filesToDelete}:{" "}
                    <span className="font-bold text-foreground">{uz.storage.filesCount(estimate.filesCount)}</span>
                  </p>
                  <p>
                    {uz.storage.bytesToFree}:{" "}
                    <span className="font-bold text-foreground">{formatBytes(estimate.bytes)}</span>
                  </p>
                </div>
              </div>

              <p className="text-body text-muted-foreground">{uz.storage.irreversible}</p>
            </>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setActiveFilter(null)} disabled={cleaning}>
              {uz.storage.bekorQilish}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCleanup}
              disabled={cleaning || estimating || estimate?.filesCount === 0}
            >
              {cleaning ? uz.storage.cleaning : uz.storage.haOchirilsin}
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
        title={uz.storage.faylniOchirish}
      >
        <div className="space-y-4">
          <p className="text-body text-foreground">{uz.storage.deleteFileQuestion(fileToDelete?.name ?? "")}</p>
          <div className="rounded-control bg-muted p-3 text-caption text-muted-foreground">
            {uz.storage.hajmi}: {formatBytes(fileToDelete?.size || 0)} <br />
            {uz.storage.manba}: {fileToDelete?.sourceTitle}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setFileToDelete(null)} disabled={deletingSingle}>
              {uz.storage.bekorQilish}
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteSingle} disabled={deletingSingle}>
              {deletingSingle ? uz.storage.deleting : uz.storage.ochirish}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

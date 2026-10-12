"use client";

import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  RotateCcw,
  Sheet,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { FIELDS, type ImportTable, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, detectColumns } from "@/lib/excel";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { checkImportAction, readExcelAction, runImportAction } from "./actions";

const SKIP = "__skip";
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Fayl yuklab olish (route handler javobi — sahifa almashmaydi) */
function download(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.append(a);
  a.click();
  a.remove();
}

/** Sahifa sarlavhasidagi "Excel" tugmasi: import, eksport, namuna (eski tizimdagi ExcelButton) */
export function ExcelMenu({
  table,
  branches,
  selectedBranch,
  canImport,
}: {
  table: ImportTable;
  branches: PickerBranch[];
  selectedBranch: string;
  canImport: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <FileSpreadsheet /> {uz.excel.button}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {canImport ? (
            <DropdownMenuItem onSelect={() => setOpen(true)}>
              <FileUp /> {uz.excel.menuImport}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => download(`/excel/${table}`)}>
            <Download /> {uz.excel.menuExport}
          </DropdownMenuItem>
          {canImport ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => download(`/excel/${table}?template=1`)}>
                <Sheet /> {uz.excel.menuTemplate}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canImport ? (
        <ImportDialog
          open={open}
          onOpenChange={setOpen}
          table={table}
          branches={branches}
          selectedBranch={selectedBranch}
        />
      ) : null}
    </>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  table,
  branches,
  selectedBranch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: ImportTable;
  branches: PickerBranch[];
  selectedBranch: string;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const fields = FIELDS[table];
  const [branchId, setBranchId] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [grid, setGrid] = React.useState<string[][]>([]);
  const [header, setHeader] = React.useState(true);
  const [mapping, setMapping] = React.useState<string[]>([]);
  const [removed, setRemoved] = React.useState<Set<number>>(new Set());
  const [errors, setErrors] = React.useState<(string | null)[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBranchId(selectedBranch !== "all" ? selectedBranch : branches.length === 1 ? branches[0]!.id : "");
      setFileName(null);
      setGrid([]);
      setMapping([]);
      setRemoved(new Set());
      setErrors(null);
      setError(null);
    }
  }

  const body = (header ? grid.slice(1) : grid).map((cells, i) => ({ i, cells })).filter((r) => !removed.has(r.i));
  const rows = body.map(({ cells }) => {
    const r: Record<string, string> = {};
    mapping.forEach((f, c) => {
      if (f && f !== SKIP) r[f] = cells[c] ?? "";
    });
    return r;
  });
  const valid = errors ? errors.filter((e) => e === null).length : 0;
  const changed = () => setErrors(null);

  function upload(file: File) {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) return setError(uz.excel.tooBig);
    const form = new FormData();
    form.set("table", table);
    form.set("file", file);
    startTransition(async () => {
      const res = await readExcelAction(form);
      if (!res.ok) return setError(res.error);
      setFileName(file.name);
      setGrid(res.rows);
      setHeader(true);
      setRemoved(new Set());
      setMapping(detectColumns(table, res.rows[0] ?? []));
      setErrors(null);
    });
  }

  function pick(col: number, field: string) {
    // Bir maydon faqat bitta ustunga
    setMapping((m) => m.map((f, i) => (i === col ? field : f === field ? "" : f)));
    changed();
  }

  function check() {
    setError(null);
    if (!branchId) return setError(uz.excel.branchRequired);
    startTransition(async () => {
      const res = await checkImportAction({ table, branchId, rows });
      if (!res.ok) return setError(res.error);
      setErrors(res.errors);
    });
  }

  function commit() {
    if (!errors) return check();
    startTransition(async () => {
      const res = await runImportAction({ table, branchId, rows });
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: uz.excel.done(res.imported, uz.excel.names[table] ?? "", rows.length - res.imported),
      });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      wide
      title={uz.excel.titles[table] ?? ""}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          {grid.length ? (
            errors ? (
              <Button onClick={commit} disabled={pending || valid === 0}>
                <Upload /> {pending ? uz.excel.importing : uz.excel.importButton(valid)}
              </Button>
            ) : (
              <Button onClick={check} disabled={pending || !rows.length}>
                <CheckCircle2 /> {pending ? uz.excel.checking : uz.excel.check}
              </Button>
            )
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {branches.length > 1 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Label className="mb-0">{uz.excel.branch}</Label>
            <Select
              value={branchId}
              onValueChange={(v) => {
                setBranchId(v);
                changed();
              }}
            >
              <SelectTrigger className="w-64" aria-label={uz.excel.branch}>
                <SelectValue placeholder={uz.excel.chooseBranch} />
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

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          aria-label={uz.excel.uploadButton}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        {!grid.length ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-8 text-center">
            <FileSpreadsheet className="size-10 text-muted-foreground" />
            <p className="text-body text-foreground">{uz.excel.uploadHint}</p>
            <p className="text-caption text-muted-foreground">{uz.excel.uploadLimits(MAX_IMPORT_ROWS)}</p>
            <Button onClick={() => fileRef.current?.click()} disabled={pending}>
              <Upload /> {uz.excel.uploadButton}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-body text-foreground">
                <CheckCircle2 className="size-4 text-(--success-fg)" /> {uz.excel.loaded(grid.length)}
                <span className="text-caption text-muted-foreground">{fileName}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <ChoiceField
                  label={uz.excel.headerRow}
                  control={
                    <Checkbox
                      checked={header}
                      onCheckedChange={(v) => {
                        setHeader(v === true);
                        setRemoved(new Set());
                        changed();
                      }}
                    />
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMapping(header ? detectColumns(table, grid[0] ?? []) : grid[0]!.map(() => ""));
                    changed();
                  }}
                >
                  <RotateCcw /> {uz.excel.redetect}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={pending}>
                  {uz.excel.another}
                </Button>
              </div>
            </div>

            {errors ? (
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">{uz.excel.ready(valid, errors.length - valid)}</Badge>
              </div>
            ) : null}

            <TableWrap className="max-h-[50vh] overflow-auto rounded-control border border-border-soft">
              <Table>
                <THead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th className="min-w-56">{errors ? uz.students.colStatus : ""}</Th>
                    {mapping.map((f, c) => (
                      <Th key={c} className="min-w-44 align-top">
                        <Select value={f || SKIP} onValueChange={(v) => pick(c, v === SKIP ? "" : v)}>
                          <SelectTrigger className="w-full" aria-label={uz.excel.column(colName(c))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP}>{uz.excel.skip}</SelectItem>
                            {fields.map((x) => (
                              <SelectItem key={x.key} value={x.key}>
                                {x.label}
                                {x.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-1 truncate text-2xs font-normal text-muted-foreground normal-case">
                          {uz.excel.column(colName(c))}
                          {header && grid[0]?.[c] ? ` · ${grid[0][c]}` : ""}
                        </div>
                      </Th>
                    ))}
                  </tr>
                </THead>
                <TBody>
                  {body.slice(0, 300).map(({ i, cells }, k) => {
                    const err = errors?.[k];
                    return (
                      <Tr key={i} className={cn(err && "bg-(--warning-bg)")}>
                        <Td className="font-mono text-caption text-muted-foreground">{i + (header ? 2 : 1)}</Td>
                        <Td>
                          <div className="flex items-center justify-between gap-2">
                            {errors ? (
                              err ? (
                                <span className="flex items-center gap-1 text-caption text-(--warning-fg)">
                                  <TriangleAlert className="size-3.5 shrink-0" /> {err}
                                </span>
                              ) : (
                                <span className="text-caption text-(--success-fg)">{uz.excel.rowOk}</span>
                              )
                            ) : null}
                            <Button
                              variant="icon"
                              size="icon-sm"
                              title={uz.common.delete}
                              aria-label={`${i + 1} — ${uz.common.delete}`}
                              onClick={() => {
                                setRemoved((s) => new Set(s).add(i));
                                changed();
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </Td>
                        {mapping.map((f, c) => (
                          <Td key={c} className={cn("max-w-56 truncate", !f && "text-muted-foreground")}>
                            {cells[c]}
                          </Td>
                        ))}
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          </>
        )}
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

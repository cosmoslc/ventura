"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange, className }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-(--table-foot) px-5 py-4",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">
          {from}–{to}
        </span>{" "}
        / <span className="font-mono">{total}</span> ta yozuv
      </p>
      <nav className="flex items-center gap-1" aria-label="Sahifalar">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft /> Oldingi
        </Button>
        <div className="mx-1 hidden items-center gap-1 sm:flex">
          {pageList(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "grid size-(--control-h-sm) cursor-pointer place-items-center rounded-btn border border-transparent font-mono text-xs font-semibold transition-colors",
                  p === page
                    ? "btn-primary-surface hover:translate-y-0"
                    : "text-secondary-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Keyingi <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}

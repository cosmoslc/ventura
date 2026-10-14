"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Label } from "@ventura/ui/label";
import { Textarea } from "@ventura/ui/textarea";
import { DEFAULT_LEAVE_REASONS } from "@/lib/reasons";
import { uz } from "@/lib/uz";
import { leaveReasonsAction } from "./actions";

/*
 * Guruhdan chiqarish oynalaridagi sabab va izoh (ADR 0031): sabab markaz ro'yxatidan tanlanadi (hisobotda
 * guruhlanadi), izoh — erkin matn. Ro'yxat oyna birinchi ochilganda bir marta o'qiladi; tahrirlangach unutiladi.
 */

let cache: Promise<string[]> | null = null;

export function forgetLeaveReasons() {
  cache = null;
}

function loadReasons(): Promise<string[]> {
  cache ??= leaveReasonsAction().then(
    (r) => (r.ok ? r.reasons : [...DEFAULT_LEAVE_REASONS]),
    () => {
      cache = null;
      return [...DEFAULT_LEAVE_REASONS];
    },
  );
  return cache;
}

export function LeaveReasonFields({
  id,
  reason,
  onReason,
  note,
  onNote,
}: {
  id: string;
  reason: string;
  onReason: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
}) {
  const [reasons, setReasons] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    let alive = true;
    void loadReasons().then((list) => {
      if (alive) setReasons(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div>
        <Label>{uz.groups.removeReason} *</Label>
        <div className="flex min-h-8 flex-wrap gap-1.5" role="radiogroup" aria-label={uz.groups.removeReason}>
          {reasons === null
            ? [96, 128, 112, 88].map((w) => (
                <span key={w} className="h-8 animate-pulse rounded-btn bg-muted" style={{ width: w }} />
              ))
            : reasons.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  role="radio"
                  aria-checked={reason === r}
                  variant={reason === r ? "primary" : "ghost"}
                  onClick={() => onReason(r)}
                >
                  {r}
                </Button>
              ))}
        </div>
      </div>
      <div>
        <Label htmlFor={`${id}-note`}>{uz.groups.removeNote}</Label>
        <Textarea
          id={`${id}-note`}
          rows={2}
          maxLength={500}
          placeholder={uz.groups.removeNotePlaceholder}
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </div>
    </>
  );
}

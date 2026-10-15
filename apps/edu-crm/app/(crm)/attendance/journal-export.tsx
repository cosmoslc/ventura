"use client";

import { FileSpreadsheet } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { uz } from "@/lib/uz";

const t = uz.attendance.journalExport;
const ALL = "all";

/**
 * Davomat jurnalini Excelga (E6j, ADR 0038): oy va guruh tanlanadi (yoki barcha guruhlar), fayl route handler'dan
 * yuklanadi. Tugma faqat `attendance.export` ruxsati bor xodimga ko'rinadi (server ham tekshiradi).
 */
export function JournalExport({ groups, month: initial }: { groups: { id: string; name: string }[]; month: string }) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(initial);
  const [group, setGroup] = React.useState(ALL);

  const href = `/attendance/excel?${new URLSearchParams({ oy: month, guruh: group }).toString()}`;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <FileSpreadsheet /> {t.button}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t.title}
        description={t.hint}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {uz.common.cancel}
            </Button>
            <Button asChild disabled={!month}>
              <a href={href} download onClick={() => setOpen(false)}>
                <FileSpreadsheet /> {t.download}
              </a>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="journal-month">{t.month}</Label>
            <Input
              id="journal-month"
              type="month"
              value={month}
              max={initial}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.group}</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-full" aria-label={t.group}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allGroups}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Modal>
    </>
  );
}

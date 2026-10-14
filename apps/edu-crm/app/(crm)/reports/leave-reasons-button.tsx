"use client";

import { ListChecks } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { uz } from "@/lib/uz";
import { saveLeaveReasonsAction } from "../groups/actions";
import { forgetLeaveReasons } from "../groups/leave-reason-fields";
import { ReasonsModal } from "../reasons-modal";

/** Guruhdan chiqish sabablari ro'yxati (eski tizimdagi "Sabablar ro'yxati" tugmasi) — ADR 0031 */
export function LeaveReasonsButton({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = React.useState(false);
  const g = uz.groups;
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <ListChecks /> {uz.reports.leaves.reasonsButton}
      </Button>
      <ReasonsModal
        open={open}
        onOpenChange={setOpen}
        reasons={reasons}
        save={saveLeaveReasonsAction}
        onSaved={forgetLeaveReasons}
        text={{
          title: g.leaveReasonsTitle,
          intro: g.leaveReasonsIntro,
          add: g.leaveReasonAdd,
          placeholder: g.leaveReasonPlaceholder,
          saved: g.leaveReasonsSaved,
        }}
      />
    </>
  );
}

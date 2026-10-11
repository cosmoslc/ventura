"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { SESSION_POLICIES, type SessionPolicy } from "@ventura/auth/policy";
import { Button } from "@ventura/ui/button";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { FieldHint } from "@ventura/ui/label";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { setSessionPolicyAction } from "../actions";

export function SessionPolicyForm({ value, canEdit }: { value: SessionPolicy; canEdit: boolean }) {
  const router = useRouter();
  const [policy, setPolicy] = React.useState<SessionPolicy>(value);
  const [pending, start] = React.useTransition();

  return (
    <div className="space-y-4">
      <RadioGroup
        value={policy}
        onValueChange={(v) => setPolicy(v as SessionPolicy)}
        className="grid-cols-2 sm:grid-cols-3"
        aria-label={uz.settings.sessionTitle}
        disabled={!canEdit}
      >
        {SESSION_POLICIES.map((p) => (
          <RadioCard key={p} value={p} title={uz.settings.sessionLabels[p]} />
        ))}
      </RadioGroup>
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            disabled={pending || policy === value}
            onClick={() =>
              start(async () => {
                const r = await setSessionPolicyAction(policy);
                if (r.ok) {
                  toast({ tone: "success", title: uz.common.saved, description: uz.settings.sessionLabels[policy] });
                  router.refresh();
                } else toast({ tone: "danger", title: r.error });
              })
            }
          >
            {uz.common.save}
          </Button>
        </div>
      ) : (
        <FieldHint>{uz.settings.onlySuperAdmin}</FieldHint>
      )}
    </div>
  );
}

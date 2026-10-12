import type { ServerState } from "@ventura/deploy";
import { Badge } from "@ventura/ui/badge";
import { uz } from "@/lib/uz";

const TONE = { online: "success", offline: "danger", unknown: "neutral" } as const;

/** Holat: rang bilan birga matn ham (rang yolg'iz ma'no tashimaydi) */
export function ServerStateBadge({ state }: { state: ServerState }) {
  return (
    <Badge tone={TONE[state]} dot>
      {uz.servers.state[state]}
    </Badge>
  );
}

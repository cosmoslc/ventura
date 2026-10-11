"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { STEPS } from "@ventura/deploy/steps";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { type LogLine, LogView } from "@ventura/ui/log-view";
import { Notice } from "@ventura/ui/notice";
import { StepList } from "@ventura/ui/step-list";
import { toast } from "@ventura/ui/toast";
import { EmptyState } from "@ventura/ui/page-header";
import { formatDateTime } from "@/lib/format";
import type { DeploymentRow, DeploymentState } from "@/lib/server/deployments-query";
import { uz } from "@/lib/uz";
import { deploymentStateAction, startDeployAction } from "./deploy-actions";

const TONE = {
  queued: "neutral",
  building: "info",
  deploying: "info",
  ready: "success",
  failed: "danger",
  canceled: "neutral",
} as const;

const isActive = (status: DeploymentRow["status"]) =>
  status === "queued" || status === "building" || status === "deploying";

function duration(row: DeploymentRow): string {
  if (!row.startedAt || !row.finishedAt) return "—";
  return uz.deploys.seconds(Math.round((Date.parse(row.finishedAt) - Date.parse(row.startedAt)) / 1000));
}

interface DeploysTabProps {
  projectId: string;
  canDeploy: boolean;
  /** Sinov drayveri ishlatilyaptimi (haqiqiy server ulanmagan) */
  simulated: boolean;
  initial: DeploymentRow[];
  workerAlive: boolean;
}

type StepFilter = (typeof STEPS)[number] | null;

export function DeploysTab({ projectId, canDeploy, simulated, initial, workerAlive }: DeploysTabProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [live, setLive] = React.useState<DeploymentState | null>(null);
  const [logs, setLogs] = React.useState<(LogLine & { step: string })[]>([]);
  const [stepFilter, setStepFilter] = React.useState<StepFilter>(null);
  const [starting, startTransition] = React.useTransition();
  const cursor = React.useRef(0);

  function select(id: string) {
    if (id === selectedId) return;
    cursor.current = 0;
    setLogs([]);
    setLive(null);
    setStepFilter(null);
    setSelectedId(id);
  }

  // Tanlangan deploy tugamaguncha har soniyada holat va yangi log qatorlari so'raladi
  React.useEffect(() => {
    if (!selectedId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasActive = false;
    let misses = 0;
    const tick = async () => {
      const state = await deploymentStateAction(selectedId, cursor.current).catch(() => null);
      if (stopped) return;
      if (!state) {
        if (++misses <= 5) timer = setTimeout(tick, 3000);
        return;
      }
      misses = 0;
      if (state.logs.length) {
        cursor.current = state.logs[state.logs.length - 1]!.id;
        setLogs((prev) => [
          ...prev,
          ...state.logs.map((l) => ({ id: l.id, text: l.line, kind: l.stream, step: l.step })),
        ]);
      }
      setLive(state);
      const active = isActive(state.deployment.status);
      // Deploy tugadi: ro'yxat va loyiha holati serverdan yangilanadi
      if (wasActive && !active) router.refresh();
      wasActive = active;
      if (active) timer = setTimeout(tick, 1000);
      else if (state.logs.length >= 500) timer = setTimeout(tick, 0); // qolgan log sahifalari
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [selectedId, router]);

  const current = live?.deployment.id === selectedId ? live : null;
  // Jonli holat ro'yxatdagi qatordan yangiroq; yangi boshlangan deploy ro'yxatga hali kelmagan bo'lishi mumkin
  const rows = React.useMemo(() => {
    if (!current) return initial;
    const merged = initial.map((r) => (r.id === current.deployment.id ? current.deployment : r));
    return merged.some((r) => r.id === current.deployment.id) ? merged : [current.deployment, ...merged];
  }, [initial, current]);
  const busy = rows.some((r) => isActive(r.status));
  const alive = current ? current.workerAlive : workerAlive;
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function start() {
    startTransition(async () => {
      const result = await startDeployAction(projectId);
      if (!result.ok) {
        toast({ tone: "danger", title: result.error });
        return;
      }
      toast({ tone: "info", title: uz.deploys.started(result.number) });
      select(result.id);
      router.refresh();
    });
  }

  const visibleLogs = stepFilter ? logs.filter((l) => l.step === stepFilter) : logs;

  return (
    <div className="space-y-4">
      {simulated ? <Notice tone="info">{uz.deploys.simNotice}</Notice> : null}
      {!alive ? <Notice tone="warning">{uz.deploys.workerDown}</Notice> : null}

      {canDeploy ? (
        <div className="flex justify-end">
          <Button onClick={start} disabled={starting || busy}>
            <Rocket /> {uz.deploys.start}
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={<Rocket />} title={uz.deploys.empty} description={uz.deploys.emptyHint} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <section aria-label={uz.deploys.history}>
            <h3 className="type-eyebrow mb-2 text-muted-foreground">{uz.deploys.history}</h3>
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={row.id === selectedId}
                    onClick={() => select(row.id)}
                    className={
                      "flex w-full cursor-pointer flex-col gap-1 rounded-btn border px-3 py-2 text-left transition-colors hover:bg-secondary " +
                      (row.id === selectedId ? "border-primary bg-primary-soft" : "border-border")
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-body font-bold text-foreground">#{row.number}</span>
                      <Badge tone={TONE[row.status]} dot>
                        {uz.deploys.statusLabels[row.status]}
                      </Badge>
                    </span>
                    <span className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
                      <span className="truncate">{row.by ?? uz.deploys.system}</span>
                      <span className="font-mono">{formatDateTime(row.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected ? (
            <section className="min-w-0 space-y-4" aria-label={`#${selected.number}`}>
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-body">
                <div>
                  <dt className="text-caption text-muted-foreground">{uz.deploys.duration}</dt>
                  <dd className="font-mono font-semibold text-foreground">{duration(selected)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{uz.deploys.commit}</dt>
                  <dd className="font-mono font-semibold text-foreground">{selected.commitSha?.slice(0, 7) ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{uz.deploys.by}</dt>
                  <dd className="font-semibold text-foreground">{selected.by ?? uz.deploys.system}</dd>
                </div>
              </dl>

              {selected.error ? <Notice tone="danger">{selected.error}</Notice> : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                <div>
                  <h3 className="type-eyebrow mb-2 text-muted-foreground">{uz.deploys.steps}</h3>
                  <StepList
                    aria-label={uz.deploys.steps}
                    selected={stepFilter}
                    onSelect={(key) => setStepFilter(key as StepFilter)}
                    steps={STEPS.map((key) => {
                      const step = current?.steps.find((s) => s.step === key);
                      return {
                        key,
                        label: uz.deploys.stepLabels[key],
                        status: step?.status ?? "pending",
                        meta: step?.seconds != null ? uz.deploys.seconds(step.seconds) : undefined,
                      };
                    })}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="type-eyebrow mb-2 text-muted-foreground">
                    {uz.deploys.log}
                    {stepFilter ? ` · ${uz.deploys.stepLabels[stepFilter]}` : ""}
                  </h3>
                  <LogView
                    lines={visibleLogs}
                    live={isActive(selected.status)}
                    empty={selected.status === "queued" ? uz.deploys.logWaiting : uz.deploys.logEmpty}
                    aria-label={uz.deploys.log}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

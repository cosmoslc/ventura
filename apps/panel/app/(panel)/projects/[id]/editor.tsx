"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  type DB_STRATEGIES,
  DEPLOY_MODES,
  PROJECT_STATUSES,
  type ProjectBrand,
  TARGET_KINDS,
} from "@ventura/db/schema/panel";
import type { Feature } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { formatUzPhone } from "@ventura/ui/phone-input";
import { ConfirmModal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { dbOptionsFor } from "@/lib/project-rules";
import { uz } from "@/lib/uz";
import { trashProjectAction, updateBrandAction, updateFeaturesAction, updateProjectAction } from "../actions";
import type { DeploymentRow } from "@/lib/server/deployments-query";
import { BrandPicker, ChoiceCards, FeaturePicker } from "../parts";
import { SecretsTab } from "./secrets-tab";
import { DeploysTab } from "./deploys-tab";

type Status = (typeof PROJECT_STATUSES)[number];
type Mode = (typeof DEPLOY_MODES)[number];
type Target = (typeof TARGET_KINDS)[number];
type DbStrategy = (typeof DB_STRATEGIES)[number];

interface EditorProps {
  canWrite: boolean;
  project: {
    id: string;
    name: string;
    slug: string;
    clientId: string;
    status: Status;
    mode: Mode;
    target: Target;
    dbStrategy: DbStrategy;
    brand: ProjectBrand;
    ownerName: string | null;
    ownerPhone: string | null;
    templateName: string;
  };
  clients: { id: string; name: string }[];
  features: Feature[];
  enabled: string[];
  domains: { hostname: string; kind: "subdomain" | "custom"; isPrimary: boolean; status: string }[];
  secrets: { ownerPassword: boolean; telegramToken: boolean };
  /** Faqat super admin: saqlangan sirlar nomlari ("Ega va sirlar" tabida boshqaruv); null — faqat bor/yo'qligi */
  secretNames: string[] | null;
  deploys: { rows: DeploymentRow[]; workerAlive: boolean; simulated: boolean; canDeploy: boolean };
}

function SaveBar({ onSave, pending, disabled }: { onSave: () => void; pending: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end border-t border-border pt-4">
      <Button onClick={onSave} disabled={pending || disabled}>
        {uz.common.save}
      </Button>
    </div>
  );
}

export function ProjectEditor({
  canWrite,
  project,
  clients,
  features,
  enabled,
  domains,
  secrets,
  secretNames,
  deploys,
}: EditorProps) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const [general, setGeneral] = React.useState({
    name: project.name,
    clientId: project.clientId,
    status: project.status,
    mode: project.mode,
    target: project.target,
    dbStrategy: project.dbStrategy,
  });
  const [brand, setBrand] = React.useState(project.brand);
  const [feats, setFeats] = React.useState(() => new Set(enabled));
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast({ tone: "success", title: uz.projects.saved });
        router.refresh();
      } else toast({ tone: "danger", title: r.error ?? uz.common.loadError });
    });

  return (
    <>
      <Card>
        <CardContent className="pt-2">
          <Tabs defaultValue="overview">
            <TabsList aria-label={project.name}>
              <TabsTrigger value="overview">{uz.projects.tabs.overview}</TabsTrigger>
              <TabsTrigger value="deploys">{uz.projects.tabs.deploys}</TabsTrigger>
              <TabsTrigger value="brand">{uz.projects.tabs.brand}</TabsTrigger>
              <TabsTrigger value="features">
                {uz.projects.tabs.features}
                <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-caption font-semibold text-primary-text">
                  {feats.size}
                </span>
              </TabsTrigger>
              <TabsTrigger value="domains">{uz.projects.tabs.domains}</TabsTrigger>
              <TabsTrigger value="owner">{uz.projects.tabs.owner}</TabsTrigger>
              {canWrite ? <TabsTrigger value="danger">{uz.projects.tabs.danger}</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="deploys">
              <DeploysTab
                projectId={project.id}
                canDeploy={deploys.canDeploy}
                simulated={deploys.simulated}
                initial={deploys.rows}
                workerAlive={deploys.workerAlive}
              />
            </TabsContent>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-name">{uz.projects.name}</Label>
                  <Input
                    id="p-name"
                    value={general.name}
                    disabled={!canWrite}
                    onChange={(e) => setGeneral({ ...general, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{uz.projects.slug}</Label>
                  <Input value={project.slug} disabled readOnly className="font-mono" />
                </div>
                <div>
                  <Label>{uz.projects.client}</Label>
                  <Select value={general.clientId} onValueChange={(v) => setGeneral({ ...general, clientId: v })}>
                    <SelectTrigger aria-label={uz.projects.client} disabled={!canWrite}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{uz.projects.status}</Label>
                  <Select value={general.status} onValueChange={(v) => setGeneral({ ...general, status: v as Status })}>
                    <SelectTrigger aria-label={uz.projects.status} disabled={!canWrite}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {uz.projects.statusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>{uz.projects.template}</Label>
                  <Input value={project.templateName} disabled readOnly />
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <ChoiceCards
                  label={uz.projects.mode}
                  value={general.mode}
                  onChange={(mode) =>
                    setGeneral({
                      ...general,
                      mode,
                      dbStrategy: dbOptionsFor(mode).includes(general.dbStrategy)
                        ? general.dbStrategy
                        : "db_per_tenant",
                    })
                  }
                  options={DEPLOY_MODES}
                  labels={{ shared: "shared", dedicated: "dedicated" }}
                  hints={uz.projects.modeHints}
                />
                <ChoiceCards
                  label={uz.projects.target}
                  value={general.target}
                  onChange={(target) => setGeneral({ ...general, target })}
                  options={TARGET_KINDS}
                  labels={uz.projects.targetLabels}
                  hints={uz.projects.targetHints}
                />
                <ChoiceCards
                  label={uz.projects.db}
                  value={general.dbStrategy}
                  onChange={(dbStrategy) => setGeneral({ ...general, dbStrategy })}
                  options={dbOptionsFor(general.mode)}
                  labels={uz.projects.dbLabels}
                  hints={uz.projects.dbHints}
                />
              </div>
              {canWrite ? (
                <SaveBar pending={pending} onSave={() => run(() => updateProjectAction(project.id, general))} />
              ) : null}
            </TabsContent>

            <TabsContent value="brand" className="space-y-6">
              <BrandPicker value={brand} onChange={setBrand} />
              {canWrite ? (
                <SaveBar pending={pending} onSave={() => run(() => updateBrandAction(project.id, brand))} />
              ) : null}
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <FeaturePicker features={features} value={feats} onChange={setFeats} disabled={!canWrite} />
              {canWrite ? (
                <SaveBar pending={pending} onSave={() => run(() => updateFeaturesAction(project.id, [...feats]))} />
              ) : null}
            </TabsContent>

            <TabsContent value="domains">
              <ul className="divide-y divide-border-soft rounded-card border border-border">
                {domains.map((d) => (
                  <li key={d.hostname} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2 font-mono text-body text-foreground">
                      {d.hostname}
                      {d.isPrimary ? <Badge tone="info">{uz.projects.primary}</Badge> : null}
                    </span>
                    <Badge tone={d.status === "active" ? "success" : "warning"} dot>
                      {d.status}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-caption text-muted-foreground">{uz.projects.domainsNote}</p>
            </TabsContent>

            <TabsContent value="owner" className="space-y-6">
              <dl className="max-w-lg divide-y divide-border-soft rounded-card border border-border text-body">
                {[
                  [uz.projects.ownerName, project.ownerName ?? "—"],
                  [
                    uz.projects.ownerPhone,
                    project.ownerPhone ? (
                      <span key="p" className="font-mono">
                        +998 {formatUzPhone(project.ownerPhone.slice(-9))}
                      </span>
                    ) : (
                      "—"
                    ),
                  ],
                  // Super admin sirlarni pastdagi ro'yxatda boshqaradi; boshqalarga faqat bor/yo'qligi
                  ...(secretNames
                    ? []
                    : [
                        [
                          uz.projects.ownerPassword,
                          secrets.ownerPassword ? uz.projects.secretStored : uz.projects.secretMissing,
                        ],
                        [
                          uz.projects.telegramToken,
                          secrets.telegramToken ? uz.projects.secretStored : uz.projects.secretMissing,
                        ],
                      ]),
                ].map(([k, v], i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              {secretNames ? (
                <SecretsTab
                  projectId={project.id}
                  present={secretNames}
                  sharedDb={project.dbStrategy === "shared_db"}
                />
              ) : (
                <p className="text-caption text-muted-foreground">{uz.projects.ownerSaved}</p>
              )}
            </TabsContent>

            {canWrite ? (
              <TabsContent value="danger">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-(--danger-border) bg-(--danger-bg) p-4">
                  <div>
                    <div className="text-body font-semibold text-foreground">{uz.projects.trash}</div>
                    <div className="text-xs text-muted-foreground">{uz.projects.trashConfirmText}</div>
                  </div>
                  <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                    <Trash2 /> {uz.projects.trash}
                  </Button>
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={uz.projects.trashConfirmTitle}
        message={uz.projects.trashConfirmText}
        confirmLabel={uz.projects.trash}
        requireText={project.slug}
        onConfirm={async () => {
          const r = await trashProjectAction(project.id);
          if (r.ok) {
            toast({ tone: "danger", title: uz.projects.trashed, description: project.name });
            router.push("/projects");
          } else toast({ tone: "danger", title: r.error });
        }}
      />
    </>
  );
}

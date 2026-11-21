"use client";

import {
  CheckCircle2,
  CreditCard,
  Flame,
  KeyRound,
  Plus,
  RefreshCw,
  Snowflake,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
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
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { randomSecret } from "@/lib/project-secrets";
import { dbOptionsFor } from "@/lib/project-rules";
import { type ProjectBillingSummary } from "@/lib/project-billing";
import { uz } from "@/lib/uz";
import {
  activateTrialProjectAction,
  extendSubscriptionAction,
  resetDirectorPasswordAction,
  toggleProjectFreezeAction,
  trashProjectAction,
  unlockDirectorAction,
  updateBrandAction,
  updateFeaturesAction,
  updateProjectAction,
} from "../actions";
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
    storageLimitMb?: number;
    storeMode?: "financial" | "inventory";
  };
  clients: { id: string; name: string }[];
  features: Feature[];
  enabled: string[];
  domains: { hostname: string; kind: "subdomain" | "custom"; isPrimary: boolean; status: string }[];
  secrets: { ownerPassword: boolean; telegramToken: boolean };
  /** Faqat super admin: saqlangan sirlar nomlari ("Ega va sirlar" tabida boshqaruv); null — faqat bor/yo'qligi */
  secretNames: string[] | null;
  deploys: { rows: DeploymentRow[]; workerAlive: boolean; simulated: boolean; canDeploy: boolean };
  director?: {
    id: string;
    name: string;
    phone: string;
    locked: boolean;
    lockedAt: string | null;
    failedAttempts: number;
    mustChangePassword: boolean;
  } | null;
  trial?: {
    days: number;
    active: boolean;
    startedAt: string | null;
    expiresAt: string | null;
    activatedAt: string | null;
    expired: boolean;
    daysLeft: number | null;
  } | null;
  billing?: ProjectBillingSummary;
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
  director,
  billing,
}: EditorProps) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [pendingAction, startActionTransition] = React.useTransition();
  const [activateTrialOpen, setActivateTrialOpen] = React.useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [extendOpen, setExtendOpen] = React.useState(false);
  const [extendMonths, setExtendMonths] = React.useState<number>(1);

  const [general, setGeneral] = React.useState({
    name: project.name,
    clientId: project.clientId,
    status: project.status,
    mode: project.mode,
    target: project.target,
    dbStrategy: project.dbStrategy,
    storageLimitGb: Math.round(((project.storageLimitMb ?? 5120) / 1024) * 10) / 10,
    storeMode: project.storeMode ?? "financial",
  });
  const [brand, setBrand] = React.useState(project.brand);
  const [feats, setFeats] = React.useState(() => new Set(enabled));
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function handleActivateTrial() {
    startActionTransition(async () => {
      const res = await activateTrialProjectAction(project.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: "Loyiha to'liq faollashtirildi!" });
      setGeneral((prev) => ({ ...prev, status: "active" }));
      router.refresh();
    });
  }

  function handleUnlockDirector() {
    startActionTransition(async () => {
      const res = await unlockDirectorAction(project.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: "Rahbar hisobi blokdan chiqarildi!" });
      router.refresh();
    });
  }

  function handleResetPassword() {
    startActionTransition(async () => {
      const res = await resetDirectorPasswordAction(project.id, newPassword);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: "Direktor paroli yangilandi!" });
      setPasswordModalOpen(false);
      router.refresh();
    });
  }

  function handleExtendSubscription() {
    startActionTransition(async () => {
      const res = await extendSubscriptionAction(project.id, extendMonths);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: `Obuna ${extendMonths} oyga muvaffaqiyatli uzaytirildi!` });
      setExtendOpen(false);
      setGeneral((prev) => ({ ...prev, status: "active" }));
      router.refresh();
    });
  }

  function handleToggleFreeze() {
    startActionTransition(async () => {
      const res = await toggleProjectFreezeAction(project.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({
        tone: res.status === "paused" ? "warning" : "success",
        title: res.status === "paused" ? "Loyiha muzlatildi (to'xtatildi)" : "Loyiha faollashtirildi (eritildi)",
      });
      setGeneral((prev) => ({ ...prev, status: res.status }));
      router.refresh();
    });
  }

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
              {/* Obuna va to'lov holati kartochkasi */}
              <div className="rounded-card border border-border bg-card p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-control ${
                        general.status === "paused"
                          ? "bg-red-500/10 text-red-500"
                          : billing?.kind === "trial"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {general.status === "paused" ? (
                        <Snowflake className="size-5" />
                      ) : billing?.kind === "trial" ? (
                        <Sparkles className="size-5" />
                      ) : (
                        <CreditCard className="size-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-body font-semibold text-foreground">Obuna va To'lovlar</span>
                        {general.status === "paused" ? (
                          <Badge tone="danger" dot>
                            Muzlatilgan
                          </Badge>
                        ) : billing?.expired ? (
                          <Badge tone="danger" dot>
                            Muddati tugagan
                          </Badge>
                        ) : billing?.kind === "trial" ? (
                          <Badge tone="warning" dot>
                            Sinov: {billing.daysLeft} kun qoldi
                          </Badge>
                        ) : billing?.kind === "subscription" ? (
                          <Badge tone={(billing.daysLeft ?? 0) <= 2 ? "warning" : "success"} dot>
                            {billing.daysLeft} kun qoldi
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Doimiy tarif</Badge>
                        )}
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {billing?.expiresAt
                          ? `Amal qilish muddati: ${new Date(billing.expiresAt).toLocaleDateString("uz-UZ")} gacha`
                          : "Amal qilish muddati cheklanmagan"}
                      </div>
                    </div>
                  </div>

                  {canWrite ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {general.status === "paused" ? (
                        <Button size="sm" disabled={pendingAction} onClick={handleToggleFreeze}>
                          <Flame className="size-4 text-amber-500" /> Muzdan chiqarish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingAction}
                          onClick={handleToggleFreeze}
                          title="Loyihani vaqtincha to'xtatish"
                        >
                          <Snowflake className="size-4 text-blue-500" /> Muzlatish
                        </Button>
                      )}

                      <Button size="sm" disabled={pendingAction} onClick={() => setExtendOpen(true)}>
                        <Plus className="size-4" /> Obunani uzaytirish
                      </Button>

                      {billing?.kind === "trial" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingAction}
                          onClick={() => setActivateTrialOpen(true)}
                        >
                          <CheckCircle2 className="size-4" /> Faollashtirish
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-border-soft">
                  <div>
                    <div className="text-caption text-muted-foreground">Tarif rejasi</div>
                    <div className="text-body font-medium text-foreground">{billing?.plan ?? "Standart"}</div>
                  </div>
                  <div>
                    <div className="text-caption text-muted-foreground">Oylik to'lov</div>
                    <div className="text-body font-medium text-foreground">
                      {billing?.monthlyPrice ? `${billing.monthlyPrice.toLocaleString("uz-UZ")} so'm` : "Bepul"}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-muted-foreground">Qolgan muddat</div>
                    <div className="text-body font-medium text-foreground">
                      {billing?.daysLeft !== null && billing?.daysLeft !== undefined
                        ? billing.daysLeft > 0
                          ? `${billing.daysLeft} kun`
                          : "Muddati tugagan"
                        : "Cheksiz"}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-muted-foreground">Tizim holati</div>
                    <div className="text-body font-medium text-foreground">
                      {general.status === "paused" ? "Muzlatilgan (Paused)" : "Faol (Active)"}
                    </div>
                  </div>
                </div>
              </div>

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
                <div>
                  <Label htmlFor="p-storage">Xotira limiti (GB)</Label>
                  <Input
                    id="p-storage"
                    type="number"
                    min={0.5}
                    max={1000}
                    step={0.5}
                    value={general.storageLimitGb}
                    disabled={!canWrite}
                    onChange={(e) => setGeneral({ ...general, storageLimitGb: Number(e.target.value) || 1 })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tizim uchun ajratilgan disk hajmi (standart 5 GB).
                  </p>
                </div>
                <div>
                  <Label>Doʻkon faoliyat rejimi</Label>
                  <Select
                    value={general.storeMode ?? "financial"}
                    onValueChange={(v) => setGeneral({ ...general, storeMode: v as "financial" | "inventory" })}
                  >
                    <SelectTrigger aria-label="Doʻkon faoliyat rejimi" disabled={!canWrite}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="financial">💳 Moliyaviy doʻkon (Narx, tannarx va foyda)</SelectItem>
                      <SelectItem value="inventory">📦 Moliyasiz doʻkon (Faqat ombor va tovarlar)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Moliyasiz rejimda barcha narx va summalar yashiriladi.
                  </p>
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
              {/* Tizim direktori hisobi (baza darajasida) */}
              <div className="max-w-lg rounded-card border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" />
                    <span className="text-body font-semibold text-foreground">Tizim direktori hisobi</span>
                  </div>
                  {director ? (
                    <Badge tone={director.locked ? "danger" : "success"} dot>
                      {director.locked ? `Bloklangan (${director.failedAttempts} ta xato urinish)` : "Faol (Bloklanmagan)"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Mavjud emas</Badge>
                  )}
                </div>

                {director ? (
                  <div className="space-y-3">
                    <div className="text-body text-secondary-foreground space-y-1">
                      <div><span className="text-muted-foreground">Ism:</span> {director.name}</div>
                      <div><span className="text-muted-foreground">Telefon:</span> <span className="font-mono">{director.phone}</span></div>
                    </div>

                    {director.locked ? (
                      <div className="rounded-control border border-red-500/30 bg-red-500/10 p-3 text-caption text-red-500">
                        Parol ketma-ket 5 marta noto'g'ri kiritilgani sababli hisob xavfsizlik tizimi tomonidan vaqtincha bloklangan.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {director.locked && canWrite ? (
                        <Button
                          size="sm"
                          disabled={pendingAction}
                          onClick={handleUnlockDirector}
                        >
                          <Unlock className="size-4" /> Blokdan chiqarish
                        </Button>
                      ) : null}

                      {canWrite ? (
                        <Button
                          size="sm"
                          disabled={pendingAction}
                          onClick={() => {
                            setNewPassword(randomSecret().slice(0, 10));
                            setPasswordModalOpen(true);
                          }}
                        >
                          <RefreshCw className="size-3.5" /> Yangi parol o'rnatish
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-caption text-muted-foreground">
                    Direktor hisobi loyiha birinchi marta deploy bo'lganda avtomatik ochiladi.
                  </p>
                )}
              </div>

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

      {/* 7 kunlik sinovni to'liq faollashtirish modali */}
      <ConfirmModal
        open={activateTrialOpen}
        onOpenChange={setActivateTrialOpen}
        title="Loyihani to'liq faollashtirish"
        message="7 kunlik sinov cheklovlari olib tashlanadi va loyiha to'liq faol (doimiy tarif) rejimiga o'tkaziladi. Tasdiqlaysizmi?"
        confirmLabel="Faollashtirish"
        onConfirm={handleActivateTrial}
      />

      {/* Direktor parolini yangilash modali */}
      <Modal
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        title="Direktor parolini yangilash"
        description="Yangi parol mijoz bazasida va panel sirlarida darhol yangilanadi hamda hisob blokdan chiqariladi."
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">Yangi parol (kamida 8 belgi)</Label>
            <div className="flex gap-2">
              <Input
                id="new-pw"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="font-mono"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => setNewPassword(randomSecret().slice(0, 10))}
                title="Tasodifiy parol"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setPasswordModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              disabled={newPassword.length < 8 || pendingAction}
              onClick={handleResetPassword}
            >
              Saqlash
            </Button>
          </div>
        </div>
      </Modal>
      {/* Obuna muddatini uzaytirish modali */}
      <Modal
        open={extendOpen}
        onOpenChange={setExtendOpen}
        title="Obuna muddatini uzaytirish"
        description="Mijoz to'lovini qabul qilib, loyiha faoliyatini uzaytirish. Muzlatilgan loyihalar avtomatik faollashtiriladi."
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Uzaytirish muddati</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { months: 1, label: "1 oy", price: billing?.monthlyPrice ?? 300_000 },
                { months: 3, label: "3 oy", price: (billing?.monthlyPrice ?? 300_000) * 3 },
                { months: 6, label: "6 oy", price: (billing?.monthlyPrice ?? 300_000) * 6 },
                { months: 12, label: "1 yil (12 oy)", price: (billing?.monthlyPrice ?? 300_000) * 12 },
              ].map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setExtendMonths(opt.months)}
                  className={`flex flex-col items-start p-3 rounded-control border text-left transition-all ${
                    extendMonths === opt.months
                      ? "border-primary bg-primary/10 text-primary-text ring-1 ring-primary"
                      : "border-border hover:border-border-hover bg-background"
                  }`}
                >
                  <span className="font-semibold text-body">{opt.label}</span>
                  <span className="text-caption text-muted-foreground font-mono">
                    {opt.price.toLocaleString("uz-UZ")} so'm
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setExtendOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" disabled={pendingAction} onClick={handleExtendSubscription}>
              To'lovni tasdiqlash (+{extendMonths} oy)
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

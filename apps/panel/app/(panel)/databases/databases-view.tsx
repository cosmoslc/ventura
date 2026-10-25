"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ServerLastAction } from "@ventura/db/schema/panel";
import type { SupabaseProject } from "@ventura/deploy";
import { Badge, type BadgeProps } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@ventura/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { formatBytes, timeAgo } from "@/lib/format";
import { uz } from "@/lib/uz";
import { useAutoRefresh } from "../servers/use-auto-refresh";
import {
  type RevealResult,
  createDatabaseAction,
  dropDatabaseAction,
  moveProjectToSupabaseAction,
  revealDatabaseUrlAction,
  saveSupabaseTokenAction,
  testSupabaseConnectionAction,
} from "./actions";

const t = uz.databases;

export interface ProjectDatabaseInfo {
  id: string;
  name: string;
  slug: string;
  templateKey: string;
  dbStrategy: string;
  serverId: string | null;
  supabase: {
    projectRef: string;
    projectName: string;
    projectUrl: string;
    mode: string;
  } | null;
}

export interface DbRow {
  name: string;
  kind: "shared" | "project" | "manual" | "other";
  projects: { id: string; name: string; slug: string; isSupabase?: boolean }[];
  sizeBytes: number;
  connections: number;
  missing: boolean;
  large: boolean;
}

export interface ServerBlock {
  id: string;
  name: string;
  host: string;
  online: boolean;
  metricsAt: string | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  listError: string | null;
  hasList: boolean;
  lastAction: ServerLastAction | null;
  rows: DbRow[];
}

export interface SupabaseBlock {
  hasToken: boolean;
  tokenPreview: string | null;
  projects: SupabaseProject[];
  error: string | null;
}

const KIND_TONE: Record<DbRow["kind"], BadgeProps["tone"]> = {
  shared: "info",
  project: "success",
  manual: "neutral",
  other: "warning",
};

export function DatabasesView({
  servers,
  supabase,
  allProjects,
  canCreate,
  canReveal,
  alertBytes,
}: {
  servers: ServerBlock[];
  supabase: SupabaseBlock;
  allProjects: ProjectDatabaseInfo[];
  canCreate: boolean;
  canReveal: boolean;
  alertBytes: number;
}) {
  useAutoRefresh(30_000);
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [reveal, setReveal] = React.useState<{ serverId: string; name: string } | null>(null);
  const [drop, setDrop] = React.useState<{ serverId: string; name: string } | null>(null);
  const [moveToSupabaseTarget, setMoveToSupabaseTarget] = React.useState<{
    id: string;
    name: string;
    slug: string;
    targetRef?: string;
  } | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = React.useState(false);

  const allVps = servers.flatMap((s) => s.rows.filter((r) => !r.missing));
  const totalVps = allVps.reduce((sum, r) => sum + r.sizeBytes, 0);
  const large = allVps.filter((r) => r.large).length;
  const connectedToSupabase = allProjects.filter((p) => !!p.supabase);

  return (
    <div className="space-y-section">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate && servers.length ? (
              <Button onClick={() => setCreateOpen(true)} variant="subtle">
                <Plus /> {t.create}
              </Button>
            ) : null}
            {canReveal && allProjects.length > 0 ? (
              <Button onClick={() => setMoveToSupabaseTarget(allProjects[0] ?? null)}>
                <Cloud /> {t.moveToSupabase}
              </Button>
            ) : null}
          </div>
        }
      />

      {/* 2 Ta Asosiy Toifa Stat Kartalari (VPS vs Supabase) */}
      <div className="grid gap-grid sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. VPS PostgreSQL Bazalari */}
        <StatCard
          icon={<Server />}
          tone={1}
          label={t.vpsTitle}
          value={`${allVps.length} ta baza`}
          hint={`${servers.filter((s) => s.online).length} server online · ${allVps.length ? formatBytes(totalVps) : "0 B"}`}
        />

        {/* 2. Supabase Cloud Bazalari */}
        <StatCard
          icon={<Cloud />}
          tone={2}
          label={t.supabaseTitle}
          value={supabase.hasToken ? `${supabase.projects.length} ta loyiha` : "Ulanmagan"}
          hint={
            supabase.hasToken
              ? `${connectedToSupabase.length} ta markaz ulangan · Bulutda`
              : "Token ulanmagan — sozlang"
          }
        />

        {/* 3. Umumiy Holat / Katta bazalar */}
        <StatCard
          icon={<HardDrive />}
          tone={3}
          label={t.totalSize}
          value={allVps.length ? formatBytes(totalVps) : "—"}
          hint={large > 0 ? t.largeDbs(formatBytes(alertBytes)) : "Barcha bazalar me'yorda"}
        />
      </div>

      {/* Bo'limlar / Tablar */}
      <Tabs defaultValue="vps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vps" className="gap-2">
            <Server className="size-4" /> {t.vpsTitle} ({allVps.length})
          </TabsTrigger>
          <TabsTrigger value="supabase" className="gap-2">
            <Cloud className="size-4" /> {t.supabaseTitle} ({supabase.hasToken ? supabase.projects.length : 0})
          </TabsTrigger>
        </TabsList>

        {/* VPS BAZALARI TABI */}
        <TabsContent value="vps" className="space-y-section">
          {servers.length ? (
            servers.map((s) => (
              <ServerSection
                key={s.id}
                server={s}
                canReveal={canReveal}
                onReveal={(name) => setReveal({ serverId: s.id, name })}
                onDrop={(name) => setDrop({ serverId: s.id, name })}
                onMigrateToSupabase={(p) => setMoveToSupabaseTarget(p)}
              />
            ))
          ) : (
            <Card>
              <EmptyState icon={<Server />} title={t.noServers} description={t.noServersHint} />
            </Card>
          )}
        </TabsContent>

        {/* SUPABASE BAZALARI TABI */}
        <TabsContent value="supabase" className="space-y-section">
          <SupabaseSection
            supabase={supabase}
            allProjects={allProjects}
            canManage={canReveal}
            onOpenTokenModal={() => setTokenModalOpen(true)}
            onMigrate={(p, targetRef) => setMoveToSupabaseTarget({ ...p, targetRef })}
          />
        </TabsContent>
      </Tabs>

      {/* MODALLAR */}
      {canCreate ? <CreateModal open={createOpen} onOpenChange={setCreateOpen} servers={servers} /> : null}
      <RevealModal target={reveal} onClose={() => setReveal(null)} />

      {canReveal ? (
        <>
          <ConfirmModal
            open={drop !== null}
            onOpenChange={(o) => !o && setDrop(null)}
            title={t.dropTitle}
            message={drop ? t.dropText(drop.name) : ""}
            confirmLabel={t.drop}
            requireText={drop?.name}
            onConfirm={async () => {
              if (!drop) return;
              const res = await dropDatabaseAction(drop, drop.name);
              if (!res.ok) return void toast({ tone: "danger", title: res.error });
              toast({ tone: "success", title: t.dropQueued, description: drop.name });
              router.refresh();
            }}
          />

          <MoveToSupabaseModal
            open={moveToSupabaseTarget !== null}
            onOpenChange={(open) => !open && setMoveToSupabaseTarget(null)}
            project={moveToSupabaseTarget}
            allProjects={allProjects}
            supabaseProjects={supabase.projects}
            hasStoredToken={supabase.hasToken}
          />

          <SupabaseTokenModal
            open={tokenModalOpen}
            onOpenChange={setTokenModalOpen}
            currentPreview={supabase.tokenPreview}
          />
        </>
      ) : null}
    </div>
  );
}

function ServerSection({
  server: s,
  canReveal,
  onReveal,
  onDrop,
  onMigrateToSupabase,
}: {
  server: ServerBlock;
  canReveal: boolean;
  onReveal: (name: string) => void;
  onDrop: (name: string) => void;
  onMigrateToSupabase: (p: { id: string; name: string; slug: string }) => void;
}) {
  const disk =
    s.diskUsedGb != null && s.diskTotalGb
      ? t.disk(s.diskUsedGb, s.diskTotalGb, Math.round((s.diskUsedGb / s.diskTotalGb) * 100))
      : null;
  const action = s.lastAction;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-heading flex items-center gap-2 text-base">
            <Link href={`/servers/${s.id}`} className="hover:underline">
              {s.name}
            </Link>
            <Badge tone={s.online ? "success" : "neutral"} dot>
              {s.online ? t.online : t.offline}
            </Badge>
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">
            {[s.host, disk, s.metricsAt ? t.updated(timeAgo(s.metricsAt)) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {action ? (
        <Notice tone={action.status === "error" ? "danger" : action.status === "ok" ? "success" : "info"}>
          {action.kind === "db_move_supabase"
            ? `Supabase'ga ko'chirish (${action.project ?? ""}): ${action.status === "ok" ? "muvaffaqiyatli yakunlandi" : action.message || "navbatda"}`
            : t.actionStatus(action.kind, action.database ?? "", action.status, action.message)}
        </Notice>
      ) : null}

      {!s.hasList ? (
        <Notice tone="warning">
          {t.noList}
          {s.listError ? <span className="mt-1 block font-mono text-caption">{s.listError}</span> : null}
        </Notice>
      ) : null}

      {s.rows.length ? (
        <TableWrap>
          <Table className="min-w-[760px]">
            <THead>
              <Tr>
                <Th>{t.colName}</Th>
                <Th>{t.colProjects}</Th>
                <Th className="text-right">{t.colSize}</Th>
                <Th className="text-right">{t.colConnections}</Th>
                {canReveal ? <Th className="text-right">{uz.common.actions}</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {s.rows.map((r) => (
                <Tr key={r.name}>
                  <Td>
                    {r.missing ? (
                      <div className="font-mono font-semibold text-foreground">{r.name}</div>
                    ) : (
                      <Link
                        href={`/databases/${s.id}/${r.name}`}
                        className="font-mono font-semibold text-foreground hover:underline"
                      >
                        {r.name}
                      </Link>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={KIND_TONE[r.kind]}>{t.kinds[r.kind]}</Badge>
                      {r.missing ? <Badge tone="danger">{t.missing}</Badge> : null}
                    </div>
                  </Td>
                  <Td>
                    {r.projects.length ? (
                      <div className="flex max-w-80 flex-wrap gap-x-2 gap-y-1">
                        {r.projects.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5">
                            <Link href={`/projects/${p.id}`} className="text-foreground hover:underline font-medium">
                              {p.name}
                            </Link>
                            {p.isSupabase ? (
                              <Badge tone="success" className="text-caption">
                                <Cloud className="size-3 mr-0.5 inline" /> Supabase
                              </Badge>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t.noProjects}</span>
                    )}
                    {r.projects.length > 1 ? (
                      <div className="text-caption text-muted-foreground">{t.projectsCount(r.projects.length)}</div>
                    ) : null}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.missing ? "—" : formatBytes(r.sizeBytes)}
                    {r.large ? (
                      <div>
                        <Badge tone="warning">{t.large}</Badge>
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-right">{r.missing ? "—" : r.connections}</Td>
                  {canReveal ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!r.missing && r.kind !== "other" ? (
                          <Button size="sm" variant="ghost" onClick={() => onReveal(r.name)}>
                            <KeyRound /> {t.reveal}
                          </Button>
                        ) : null}

                        {/* Supabase'ga ko'chirish tugmasi */}
                        {r.projects.length === 1 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => onMigrateToSupabase(r.projects[0]!)}
                          >
                            <Cloud className="size-4" /> {t.moveToSupabase}
                          </Button>
                        ) : null}

                        {!r.missing && !r.projects.length && !r.name.endsWith("_shared") ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={t.drop}
                            aria-label={`${r.name} — ${t.drop}`}
                            onClick={() => onDrop(r.name)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : s.hasList ? (
        <p className="text-body text-muted-foreground">{t.empty}</p>
      ) : null}
    </div>
  );
}

function SupabaseSection({
  supabase,
  allProjects,
  canManage,
  onOpenTokenModal,
  onMigrate,
}: {
  supabase: SupabaseBlock;
  allProjects: ProjectDatabaseInfo[];
  canManage: boolean;
  onOpenTokenModal: () => void;
  onMigrate: (p: ProjectDatabaseInfo, targetRef?: string) => void;
}) {
  const byRef = new Map<string, ProjectDatabaseInfo>();
  for (const p of allProjects) {
    if (p.supabase?.projectRef) {
      byRef.set(p.supabase.projectRef, p);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="type-heading text-base flex items-center gap-2">
            <Cloud className="size-5 text-emerald-500" />
            {t.supabaseTitle}
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">{t.supabaseDescription}</p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            {supabase.hasToken ? (
              <Badge tone="success" dot className="font-mono">
                Token: {supabase.tokenPreview}
              </Badge>
            ) : null}
            <Button size="sm" variant="subtle" onClick={onOpenTokenModal}>
              {supabase.hasToken ? "Tokenni yangilash" : t.supabaseSaveToken}
            </Button>
          </div>
        ) : null}
      </div>

      {supabase.error ? <Notice tone="danger">{supabase.error}</Notice> : null}

      {!supabase.hasToken ? (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
            <div className="p-3 bg-secondary rounded-full text-foreground">
              <Cloud className="size-8 text-emerald-500" />
            </div>
            <h3 className="type-heading text-base font-semibold">{t.supabaseNoToken}</h3>
            <p className="text-body text-muted-foreground">{t.supabaseNoTokenHint}</p>
            {canManage ? (
              <Button onClick={onOpenTokenModal} className="mt-2">
                <Plus /> {t.supabaseSaveToken}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : supabase.projects.length ? (
        <TableWrap>
          <Table className="min-w-[760px]">
            <THead>
              <Tr>
                <Th>Supabase Loyihasi</Th>
                <Th>Mintaqa (Region)</Th>
                <Th>Holat</Th>
                <Th>Ulangan Ventura Loyihasi</Th>
                {canManage ? <Th className="text-right">{uz.common.actions}</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {supabase.projects.map((proj) => {
                const linked = byRef.get(proj.id);
                return (
                  <Tr key={proj.id}>
                    <Td>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {proj.name}
                        <a
                          href={`https://supabase.com/dashboard/project/${proj.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex items-center"
                          title="Supabase Studio'da ochish"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                      <div className="font-mono text-caption text-muted-foreground">{proj.id}</div>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{proj.region}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={proj.status === "ACTIVE_HEALTHY" ? "success" : "warning"} dot>
                        {proj.status === "ACTIVE_HEALTHY" ? "Faol (Active)" : proj.status}
                      </Badge>
                    </Td>
                    <Td>
                      {linked ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/projects/${linked.id}`} className="font-medium text-foreground hover:underline">
                            {linked.name}
                          </Link>
                          <Badge tone="success">
                            {linked.supabase?.mode === "full" ? "To'liq nusxa" : "Toza sxema"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Bo'sh (Ulanmagan)</span>
                      )}
                    </Td>
                    {canManage ? (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const target = linked || allProjects[0];
                              if (target) onMigrate(target, proj.id);
                            }}
                          >
                            <ArrowRightLeft className="size-4" /> Ko'chirish
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          Supabase hisobingizda loyihalar topilmadi. Supabase dashboardida yangi loyiha oching yoki boshqa token kiriting.
        </Card>
      )}
    </div>
  );
}

function MoveToSupabaseModal({
  open,
  onOpenChange,
  project,
  allProjects,
  supabaseProjects,
  hasStoredToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; slug: string; targetRef?: string } | null;
  allProjects: ProjectDatabaseInfo[];
  supabaseProjects: SupabaseProject[];
  hasStoredToken: boolean;
}) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = React.useState(project?.id ?? allProjects[0]?.id ?? "");
  const [projectRef, setProjectRef] = React.useState(project?.targetRef || supabaseProjects[0]?.id || "");
  const [dbPassword, setDbPassword] = React.useState("");
  const [mode, setMode] = React.useState<"full" | "schema_only">("full");
  const [customToken, setCustomToken] = React.useState("");
  const [confirmSlug, setConfirmSlug] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (project) {
      setSelectedProjectId(project.id);
      if (project.targetRef) setProjectRef(project.targetRef);
      else if (supabaseProjects[0]?.id) setProjectRef(supabaseProjects[0].id);
    }
  }, [project, supabaseProjects]);

  const currentProject = allProjects.find((p) => p.id === selectedProjectId) || project;

  async function handleTestConnection() {
    if (!projectRef.trim() || !dbPassword.trim()) {
      return setTestResult({ ok: false, message: "Loyiha ref va bazaning parolini kiriting" });
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnectionAction({
        projectRef: projectRef.trim(),
        dbPassword: dbPassword.trim(),
        customToken: customToken.trim() || undefined,
      });
      if (res.ok) {
        setTestResult({ ok: true, message: `Muvaffaqiyatli ulandi! PostgreSQL versiyasi: ${res.version.split(" ")[1] ?? "15+"}` });
      } else {
        setTestResult({ ok: false, message: res.error });
      }
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentProject) return;

    startTransition(async () => {
      const res = await moveProjectToSupabaseAction(
        {
          projectId: currentProject.id,
          projectRef: projectRef.trim(),
          dbPassword: dbPassword.trim(),
          mode,
          customToken: customToken.trim() || undefined,
        },
        confirmSlug.trim(),
      );

      if (!res.ok) {
        return setError(res.error);
      }

      toast({
        tone: "success",
        title: "Supabase'ga ko'chirish navbatga qo'yildi",
        description: `${currentProject.name} ko'chirilmoqda. Jarayon fonda bajariladi.`,
      });
      onOpenChange(false);
      setDbPassword("");
      setConfirmSlug("");
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.moveToSupabaseTitle}
      description={currentProject ? t.moveToSupabaseText(currentProject.name) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button
            type="submit"
            form="supabase-move-form"
            disabled={
              pending ||
              !currentProject ||
              !projectRef.trim() ||
              !dbPassword.trim() ||
              confirmSlug.trim() !== currentProject.slug
            }
          >
            {pending ? <Loader2 className="animate-spin mr-2" /> : <Cloud className="mr-2" />}
            Ko'chirishni boshlash
          </Button>
        </>
      }
    >
      <form id="supabase-move-form" onSubmit={submit} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {/* 1. Qaysi Ventura loyihasi ko'chiriladi */}
        <div>
          <Label htmlFor="target-project">Ventura Loyihasi (O'quv Markazi)</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger id="target-project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.slug}) {p.supabase ? "• [Supabase'da]" : "• [VPS'da]"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Supabase loyihasini tanlash */}
        <div>
          <Label htmlFor="supabase-project">{t.supabaseProject}</Label>
          {supabaseProjects.length ? (
            <Select value={projectRef} onValueChange={setProjectRef}>
              <SelectTrigger id="supabase-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supabaseProjects.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.name} ({sp.region}) — {sp.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="supabase-project"
              value={projectRef}
              onChange={(e) => setProjectRef(e.target.value)}
              placeholder="masalan: abcdefghijklmnopqrst"
              required
            />
          )}
          <FieldHint>Supabase boshqaruv panelidagi loyihaning Reference ID si</FieldHint>
        </div>

        {/* Agar token yo'q bo'lsa yoki boshqa token kerak bo'lsa */}
        {!hasStoredToken ? (
          <div>
            <Label htmlFor="custom-token">Supabase Token (Personal Access Token)</Label>
            <Input
              id="custom-token"
              type="password"
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              placeholder="sbp_..."
              required
            />
            <FieldHint>Supabase Account -&gt; Access Tokens bo'limidan olingan kalit</FieldHint>
          </div>
        ) : null}

        {/* 3. Baza Paroli va Aloqani Sinash */}
        <div>
          <Label htmlFor="db-password">{t.supabasePassword}</Label>
          <div className="flex gap-2">
            <Input
              id="db-password"
              type="password"
              value={dbPassword}
              onChange={(e) => {
                setDbPassword(e.target.value);
                setTestResult(null);
              }}
              placeholder="••••••••••••"
              required
            />
            <Button
              type="button"
              variant="subtle"
              disabled={testing || !projectRef.trim() || !dbPassword.trim()}
              onClick={handleTestConnection}
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t.testConnection}
            </Button>
          </div>
          <FieldHint>{t.supabasePasswordHint}</FieldHint>

          {testResult ? (
            <div className="mt-2">
              <Notice tone={testResult.ok ? "success" : "danger"}>{testResult.message}</Notice>
            </div>
          ) : null}
        </div>

        {/* 4. Ko'chirish Rejimi (User Talabi: Ma'lumotli vs Ma'lumotsiz) */}
        <div>
          <Label>Ko'chirish usuli</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                mode === "full"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Database className="size-4 text-emerald-500" />
                {t.modeFull}
              </div>
              <p className="mt-1 text-caption text-muted-foreground">{t.modeFullHint}</p>
            </button>

            <button
              type="button"
              onClick={() => setMode("schema_only")}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                mode === "schema_only"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Zap className="size-4 text-amber-500" />
                {t.modeSchema}
              </div>
              <p className="mt-1 text-caption text-muted-foreground">{t.modeSchemaHint}</p>
            </button>
          </div>
        </div>

        {/* 5. Xavfsiz Tasdiqlash */}
        <div>
          <Label htmlFor="confirm-slug">
            Tasdiqlash: <span className="font-mono font-bold text-foreground">{currentProject?.slug}</span> deb yozing
          </Label>
          <Input
            id="confirm-slug"
            className="font-mono"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={currentProject?.slug}
            required
          />
        </div>
      </form>
    </Modal>
  );
}

function SupabaseTokenModal({
  open,
  onOpenChange,
  currentPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPreview: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveSupabaseTokenAction(token.trim());
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: token.trim() ? "Supabase token saqlandi" : "Token o'chirildi",
        description: token.trim() ? `${res.count} ta Supabase loyihasi aniqlandi` : undefined,
      });
      onOpenChange(false);
      setToken("");
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Supabase Boshqaruv Tokeni"
      description="Supabase Personal Access Token (sbp_...) orqali tashkilot loyihalari, API kalitlar va ulanish parametrlari 100% avtomatik boshqariladi."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="supa-token-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />}
            Saqlash
          </Button>
        </>
      }
    >
      <form id="supa-token-form" onSubmit={save} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {currentPreview ? (
          <div className="p-3 bg-secondary rounded-lg text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Hozirgi saqlangan token:</span>
            <span className="font-mono font-semibold">{currentPreview}</span>
          </div>
        ) : null}

        <div>
          <Label htmlFor="supa-token">Personal Access Token</Label>
          <Input
            id="supa-token"
            type="password"
            className="font-mono"
            value={token}
            placeholder={currentPreview ? "Yangi token (bo'sh qoldirilsa o'chiriladi)" : "sbp_..."}
            onChange={(e) => setToken(e.target.value)}
          />
          <FieldHint>
            Tokenni olish: Supabase sayti -&gt; Profilingiz (Account) -&gt; Access Tokens bo'limidan "Generate new token".
          </FieldHint>
        </div>
      </form>
    </Modal>
  );
}

function CreateModal({
  open,
  onOpenChange,
  servers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: ServerBlock[];
}) {
  const router = useRouter();
  const [serverId, setServerId] = React.useState(servers[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createDatabaseAction({ serverId, name: name.trim() });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.createQueued, description: name.trim() });
      setName("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.create}
      description={t.createDescription}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="db-create-form" disabled={pending || !serverId || !name.trim()}>
            {t.createSubmit}
          </Button>
        </>
      }
    >
      <form id="db-create-form" onSubmit={submit} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div>
          <Label htmlFor="db-server">{t.server}</Label>
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger id="db-server">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="db-name">{t.name}</Label>
          <Input
            id="db-name"
            className="font-mono"
            value={name}
            placeholder="analytics"
            maxLength={63}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
          <FieldHint>{t.nameHint}</FieldHint>
        </div>
      </form>
    </Modal>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-caption" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="ghost"
          size="icon"
          title={t.copy}
          aria-label={t.copy}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => toast({ tone: "success", title: t.copied }));
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

function RevealModal({ target, onClose }: { target: { serverId: string; name: string } | null; onClose: () => void }) {
  const [result, setResult] = React.useState<Extract<RevealResult, { ok: true }> | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [shownFor, setShownFor] = React.useState<typeof target>(null);
  const [, startTransition] = React.useTransition();
  if (target !== shownFor) {
    setShownFor(target);
    setResult(null);
    setAsking(target !== null);
  }

  function load() {
    if (!target) return;
    startTransition(async () => {
      const res = await revealDatabaseUrlAction(target);
      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return onClose();
      }
      setResult(res);
    });
  }

  function close() {
    setResult(null);
    onClose();
  }

  return (
    <>
      <ConfirmModal
        open={asking}
        onOpenChange={setAsking}
        title={t.revealTitle}
        message={target ? t.revealText(target.name) : ""}
        confirmLabel={t.reveal}
        onConfirm={load}
      />
      <Modal
        open={result !== null}
        onOpenChange={(o) => !o && close()}
        title={target?.name ?? ""}
        description={t.revealDescription}
      >
        {result ? (
          <div className="space-y-4">
            <CopyRow label={t.urlServer} value={result.url} />
            <CopyRow label={t.tunnelCommand} value={result.tunnelCommand} />
            <CopyRow label={t.urlTunnel} value={result.tunnelUrl} />
            <FieldHint>{t.tunnelHint}</FieldHint>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

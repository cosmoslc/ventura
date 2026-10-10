"use client";

import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DB_STRATEGIES, DEPLOY_MODES, type ProjectBrand, TARGET_KINDS } from "@ventura/db/schema/panel";
import { type Feature, withRequirements } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent } from "@ventura/ui/card";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Stepper } from "@ventura/ui/stepper";
import { toast } from "@ventura/ui/toast";
import { BASE_DOMAIN, HOST_RE, slugProblem, slugify } from "@/lib/project-rules";
import { uz } from "@/lib/uz";
import { checkSlugAction, createProjectAction } from "../actions";
import { BrandPicker, ChoiceCards, FeaturePicker } from "../parts";

interface TemplateOption {
  key: string;
  name: string;
  description: string | null;
  version: string;
  features: Feature[];
}

type Mode = (typeof DEPLOY_MODES)[number];
type Target = (typeof TARGET_KINDS)[number];
type DbStrategy = (typeof DB_STRATEGIES)[number];

function randomPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const NEW = "__new__";

export function ProjectWizard({
  templates,
  clients,
}: {
  templates: TemplateOption[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [maxStep, setMaxStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  // 1. Shablon
  const [templateKey, setTemplateKey] = React.useState(templates[0]?.key ?? "");
  const template = templates.find((t) => t.key === templateKey);
  // 2. Nom, mijoz, domen
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? NEW);
  const [newClientName, setNewClientName] = React.useState("");
  const [newClientPhone, setNewClientPhone] = React.useState("");
  const [domainKind, setDomainKind] = React.useState<"subdomain" | "custom">("subdomain");
  const [customDomain, setCustomDomain] = React.useState("");
  // 3. Brend
  const [brand, setBrand] = React.useState<ProjectBrand>({ primary: "#3f6df6", appearance: "light" });
  // 4. Ega
  const [ownerLogin, setOwnerLogin] = React.useState("admin");
  const [ownerPassword, setOwnerPassword] = React.useState(() => randomPassword());
  // 5. Bo'limlar — boshida hammasi yoqilgan (rejimlardan tashqari)
  const [features, setFeatures] = React.useState<Set<string>>(() =>
    template
      ? withRequirements(
          template.features,
          template.features.filter((f) => f.type !== "mode").map((f) => f.key),
        )
      : new Set(),
  );
  // 6. Rejim, manzil, baza
  const [mode, setMode] = React.useState<Mode>("shared");
  const [target, setTarget] = React.useState<Target>("home");
  const [dbStrategy, setDbStrategy] = React.useState<DbStrategy>("db_per_tenant");
  // 7. Integratsiyalar
  const [telegramToken, setTelegramToken] = React.useState("");
  const [githubRepo, setGithubRepo] = React.useState("");

  function pickTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.find((x) => x.key === key);
    if (t)
      setFeatures(
        withRequirements(
          t.features,
          t.features.filter((f) => f.type !== "mode").map((f) => f.key),
        ),
      );
  }

  /** Qadamni tekshirish; xato bo'lsa matnini qaytaradi. */
  async function validate(i: number): Promise<string | null> {
    if (i === 0 && !template) return uz.templates.empty;
    if (i === 1) {
      if (name.trim().length < 2) return uz.projects.name;
      const sp = slugProblem(slug);
      if (sp) return sp;
      const check = await checkSlugAction(slug);
      if (!check.available) return check.error ?? uz.projects.slugTaken;
      if (clientId === NEW && newClientName.trim().length < 2) return uz.wizard.pickClient;
      if (domainKind === "custom" && !HOST_RE.test(customDomain.trim().toLowerCase())) return uz.projects.hostInvalid;
    }
    if (i === 3) {
      if (!/^[a-z0-9._-]{3,32}$/i.test(ownerLogin)) return uz.projects.ownerLogin;
      if (ownerPassword.length < 8) return uz.projects.ownerPassword;
    }
    return null;
  }

  function goNext() {
    start(async () => {
      const problem = await validate(step);
      if (step === 1) setSlugError(problem && slugProblem(slug) !== null ? problem : null);
      setError(problem);
      if (problem) return;
      const next = step + 1;
      setStep(next);
      setMaxStep((m) => Math.max(m, next));
    });
  }

  function submit() {
    start(async () => {
      const res = await createProjectAction({
        templateKey,
        name: name.trim(),
        slug,
        clientId: clientId === NEW ? null : clientId,
        newClient: clientId === NEW ? { name: newClientName.trim(), phone: newClientPhone } : null,
        domainKind,
        customDomain: customDomain.trim().toLowerCase(),
        brand,
        ownerLogin,
        ownerPassword,
        features: [...features],
        mode,
        target,
        dbStrategy,
        telegramToken,
        githubRepo,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({ tone: "success", title: uz.wizard.created, description: name });
      router.push(`/projects/${res.id}`);
    });
  }

  const last = uz.wizard.steps.length - 1;
  const clientName = clientId === NEW ? newClientName : clients.find((c) => c.id === clientId)?.name;

  return (
    <Card>
      <CardContent className="space-y-6">
        <Stepper
          steps={uz.wizard.steps}
          current={step}
          canGoTo={(i) => i <= maxStep}
          onStepClick={(i) => {
            setError(null);
            setStep(i);
          }}
        />

        <div className="min-h-[280px] border-t border-border pt-6">
          {error ? (
            <div className="mb-4">
              <FieldHint error>{error}</FieldHint>
            </div>
          ) : null}

          {step === 0 ? (
            <div>
              <Label>{uz.wizard.chooseTemplate}</Label>
              <RadioGroup value={templateKey} onValueChange={pickTemplate} aria-label={uz.projects.template}>
                {templates.map((t) => (
                  <RadioCard
                    key={t.key}
                    value={t.key}
                    title={
                      <span className="flex items-center gap-2">
                        {t.name} <span className="font-mono text-caption text-muted-foreground">v{t.version}</span>
                      </span>
                    }
                    description={`${t.description ?? ""} · ${t.features.length} ${uz.templates.features}`}
                  />
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="w-name">{uz.projects.name}</Label>
                <Input
                  id="w-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    // Slug qo'lda o'zgartirilmaguncha nomdan avtomatik
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Bilim akademiyasi"
                  autoFocus
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="w-slug">{uz.projects.slug}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="w-slug"
                    value={slug}
                    aria-invalid={!!slugError || undefined}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase());
                    }}
                    className="font-mono"
                    placeholder="bilim"
                  />
                  <span className="shrink-0 font-mono text-body text-muted-foreground">.{BASE_DOMAIN}</span>
                </div>
                {slugError ? (
                  <FieldHint error>{slugError}</FieldHint>
                ) : (
                  <FieldHint>{uz.projects.slugInvalid}</FieldHint>
                )}
              </div>
              <div>
                <Label>{uz.projects.client}</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger aria-label={uz.projects.client}>
                    <SelectValue placeholder={uz.wizard.pickClient} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW}>+ {uz.wizard.newClient}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {clientId === NEW ? (
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="w-cname">{uz.clients.name}</Label>
                    <Input id="w-cname" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="w-cphone">{uz.clients.phone}</Label>
                    <PhoneInput id="w-cphone" value={newClientPhone} onValueChange={setNewClientPhone} />
                  </div>
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              <div className="sm:col-span-2">
                <Label>{uz.projects.domain}</Label>
                <RadioGroup
                  value={domainKind}
                  onValueChange={(v) => setDomainKind(v as "subdomain" | "custom")}
                  className="sm:grid-cols-2"
                  aria-label={uz.projects.domain}
                >
                  <RadioCard
                    value="subdomain"
                    title={uz.wizard.subdomain}
                    description={<span className="font-mono">{(slug || "slug") + "." + BASE_DOMAIN}</span>}
                  />
                  <RadioCard value="custom" title={uz.wizard.customDomain} description={uz.wizard.customHint} />
                </RadioGroup>
                {domainKind === "custom" ? (
                  <div className="mt-3">
                    <Input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="crm.bilim.uz"
                      className="font-mono"
                      aria-label={uz.wizard.customDomain}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? <BrandPicker value={brand} onChange={setBrand} /> : null}

          {step === 3 ? (
            <div className="max-w-md space-y-4">
              <p className="text-body text-muted-foreground">{uz.wizard.ownerHint}</p>
              <div>
                <Label htmlFor="w-login">{uz.projects.ownerLogin}</Label>
                <Input
                  id="w-login"
                  value={ownerLogin}
                  onChange={(e) => setOwnerLogin(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="w-pass">{uz.projects.ownerPassword}</Label>
                <div className="flex gap-2">
                  <Input
                    id="w-pass"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={uz.wizard.generate}
                    onClick={() => setOwnerPassword(randomPassword())}
                  >
                    <KeyRound />
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={uz.wizard.copy}
                    onClick={() => {
                      void navigator.clipboard.writeText(ownerPassword);
                      toast({ tone: "info", title: uz.wizard.copied });
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 && template ? (
            <FeaturePicker features={template.features} value={features} onChange={setFeatures} />
          ) : null}

          {step === 5 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <ChoiceCards
                label={uz.projects.mode}
                value={mode}
                onChange={setMode}
                options={DEPLOY_MODES}
                labels={{ shared: "shared", dedicated: "dedicated", fork: "fork" }}
                hints={uz.projects.modeHints}
              />
              <ChoiceCards
                label={uz.projects.target}
                value={target}
                onChange={setTarget}
                options={TARGET_KINDS}
                labels={uz.projects.targetLabels}
                hints={uz.projects.targetHints}
              />
              <ChoiceCards
                label={uz.projects.db}
                value={dbStrategy}
                onChange={setDbStrategy}
                options={DB_STRATEGIES}
                labels={uz.projects.dbLabels}
                hints={uz.projects.dbHints}
              />
            </div>
          ) : null}

          {step === 6 ? (
            <div className="max-w-md space-y-4">
              <p className="text-body text-muted-foreground">{uz.wizard.integrationsHint}</p>
              <div>
                <Label htmlFor="w-tg">{uz.projects.telegramToken}</Label>
                <Input
                  id="w-tg"
                  type="password"
                  autoComplete="off"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="font-mono"
                  placeholder="123456:ABC…"
                />
              </div>
              <div>
                <Label htmlFor="w-gh">{uz.wizard.githubRepo}</Label>
                <Input
                  id="w-gh"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  disabled={mode !== "fork"}
                  className="font-mono"
                  placeholder={`ventura-${slug || "slug"}`}
                />
                <FieldHint>{uz.wizard.githubHint}</FieldHint>
              </div>
            </div>
          ) : null}

          {step === last ? (
            <div>
              <p className="mb-4 text-body text-muted-foreground">{uz.wizard.review}</p>
              <dl className="grid gap-x-8 gap-y-3 rounded-card border border-border p-5 text-body sm:grid-cols-2">
                {[
                  [uz.projects.template, template?.name],
                  [uz.projects.name, name],
                  [uz.projects.client, clientName],
                  [uz.projects.domain, domainKind === "custom" ? customDomain : `${slug}.${BASE_DOMAIN}`],
                  [uz.wizard.color, brand.primary],
                  [uz.projects.ownerLogin, ownerLogin],
                  [uz.projects.tabs.features, `${features.size} ${uz.templates.features}`],
                  [uz.projects.mode, mode],
                  [uz.projects.target, uz.projects.targetLabels[target]],
                  [uz.projects.db, uz.projects.dbLabels[dbStrategy]],
                  [uz.projects.telegramToken, telegramToken ? uz.projects.secretStored : uz.projects.secretMissing],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border-soft pb-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate text-right font-semibold text-foreground">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center gap-2">
                <Badge tone="neutral" dot>
                  {uz.projects.statusLabels.draft}
                </Badge>
                <span className="text-xs text-muted-foreground">{uz.wizard.description}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-5">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? router.push("/projects") : setStep((s) => s - 1))}
            disabled={pending}
          >
            <ArrowLeft /> {step === 0 ? uz.common.cancel : uz.common.back}
          </Button>
          {step < last ? (
            <Button onClick={goNext} disabled={pending}>
              {uz.common.next} <ArrowRight />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending ? <Check /> : <Rocket />} {uz.wizard.createAndSave}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

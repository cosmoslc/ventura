import { asc } from "drizzle-orm";
import { Blocks } from "lucide-react";
import { templates } from "@ventura/db/schema/panel";
import { FEATURE_TYPE_LABELS, type Feature } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export const metadata = { title: `${uz.templates.title} · ${uz.app.name}` };

const TYPE_TONE = { permanent: "info", core: "warning", mode: "neutral", regular: "success" } as const;

function groupBy(features: Feature[]) {
  const map = new Map<string, Feature[]>();
  for (const f of features) map.set(f.group, [...(map.get(f.group) ?? []), f]);
  return [...map.entries()];
}

export default async function TemplatesPage() {
  await requireViewer();
  const { db } = deps();
  const rows = await db.select().from(templates).orderBy(asc(templates.name));

  return (
    <>
      <PageHeader title={uz.templates.title} description={uz.templates.description} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Blocks />} title={uz.templates.empty} description={uz.templates.emptyHint} />
        </Card>
      ) : (
        <div className="space-y-6">
          {rows.map((t) => {
            const features = t.manifest as Feature[];
            const names = new Map(features.map((f) => [f.key, f.name]));
            return (
              <Card key={t.key} className="overflow-hidden">
                <CardHeader>
                  <div>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{t.category}</Badge>
                    <Badge>
                      {features.length} {uz.templates.features}
                    </Badge>
                    <span className="font-mono text-caption text-muted-foreground">
                      {t.key}@{t.version} · {t.appPath}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {groupBy(features).map(([group, list]) => (
                    <div key={group}>
                      <div className="type-eyebrow mb-2 text-muted-foreground">{group}</div>
                      <ul className="divide-y divide-border-soft rounded-card border border-border">
                        {list.map((f) => (
                          <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                            <span className="text-body font-semibold text-foreground">{f.name}</span>
                            <span className="font-mono text-caption text-muted-foreground">{f.key}</span>
                            <Badge tone={TYPE_TONE[f.type]}>{FEATURE_TYPE_LABELS[f.type]}</Badge>
                            {f.requires.length ? (
                              <span className="text-xs text-muted-foreground">
                                {uz.templates.requires}: {f.requires.map((r) => names.get(r) ?? r).join(", ")}
                              </span>
                            ) : null}
                            {f.routes.length ? (
                              <span className="ml-auto hidden font-mono text-caption text-muted-foreground md:inline">
                                {f.routes.join(" · ")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-caption text-muted-foreground">
                    {uz.templates.synced}: <span className="font-mono">{formatDateTime(t.syncedAt)}</span> ·{" "}
                    {uz.templates.syncHint}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

import { ArrowUpRight, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Card } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { REPORT_GROUPS, type ReportDef } from "@/lib/server/reports";
import { uz } from "@/lib/uz";

const t = uz.reports;

export interface HubItem {
  group: ReportDef["group"];
  href: string;
  title: string;
  hint: string;
}

/**
 * Hisobotlar sahifasi tarkibi (ADR 0030): guruhlar bo'limlari, har hisobot — sarlavha va bir qator izohli karta.
 * Ruxsat bo'yicha saralash chaqiruvchida (page.tsx); bu yerda faqat chizish, ma'lumot so'ralmaydi.
 */
export function ReportsHub({ items }: { items: HubItem[] }) {
  const sections = REPORT_GROUPS.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter(
    (s) => s.items.length,
  );
  return (
    <div className="space-y-5">
      <PageHeader title={t.title} description={t.description} />
      {sections.length ? (
        <div className="space-y-5">
          {sections.map((s) => (
            <section key={s.group} className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
              <div className="lg:pt-1">
                <h2 className="type-heading text-lg text-foreground">{t.navGroups[s.group]}</h2>
                <p className="mt-1 text-caption text-muted-foreground">{t.hubHints[s.group]}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {s.items.map((r) => (
                  <Link key={r.href} href={r.href} className="group min-w-0 rounded-card outline-offset-2">
                    <Card className="h-full p-4 transition-[border-color,box-shadow] duration-150 group-hover:border-(--ring-border) group-hover:shadow-card-hover">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-body font-semibold text-foreground group-hover:text-primary-text">
                          {r.title}
                        </span>
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-text" />
                      </div>
                      <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{r.hint}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<BarChart3 />} title={t.noAccess} />
        </Card>
      )}
    </div>
  );
}

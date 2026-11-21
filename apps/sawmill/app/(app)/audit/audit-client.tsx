"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Search, ShieldCheck, User } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { type Locale, t } from "@/lib/i18n";
import { type AuditItem, verifyAuditChainAction } from "./actions";

interface AuditClientProps {
  initialEvents: AuditItem[];
  locale: Locale;
}

export function AuditClient({ initialEvents, locale }: AuditClientProps) {
  const [events] = React.useState<AuditItem[]>(initialEvents);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [verdict, setVerdict] = React.useState<{
    checked: boolean;
    ok: boolean;
    count?: number;
    error?: string;
  } | null>(null);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditChainAction();
      if (res.ok) {
        setVerdict({ checked: true, ok: true, count: res.count });
      } else {
        setVerdict({
          checked: true,
          ok: false,
          error: `Zanjirda uzilish: seq #${res.brokenAtSeq}`,
        });
      }
    } catch (e) {
      setVerdict({
        checked: true,
        ok: false,
        error: (e as Error).message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const filteredEvents = React.useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        (e.actorName && e.actorName.toLowerCase().includes(q)) ||
        (e.targetType && e.targetType.toLowerCase().includes(q)),
    );
  }, [events, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("audit_title", locale)}</h1>
          <p className="text-body text-muted-foreground">{t("audit_subtitle", locale)}</p>
        </div>

        <Button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <ShieldCheck className="size-4" />
          <span>{verifying ? t("status_loading", locale) : t("audit_verify_btn", locale)}</span>
        </Button>
      </div>

      {/* Verification Verdict Banner */}
      {verdict?.checked && (
        <Card
          className={`p-4 border ${
            verdict.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {verdict.ok ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <div>
              <div className="font-semibold text-body">
                {verdict.ok ? t("audit_verify_success", locale) : t("audit_verify_failed", locale)}
              </div>
              {verdict.ok && verdict.count !== undefined && (
                <div className="text-2xs opacity-90 font-mono">
                  Jami tekshirilgan havolalar: {verdict.count} ta yozuv
                </div>
              )}
              {!verdict.ok && verdict.error && <div className="text-2xs opacity-90 font-mono">{verdict.error}</div>}
            </div>
          </div>
        </Card>
      )}

      {/* Filter / Search Bar */}
      <Card className="p-4 border-border">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Amal, foydalanuvchi yoki obyekt bo'yicha qidiruv..."
            className="pl-9 h-10 text-body"
          />
        </div>
      </Card>

      {/* Audit Events Table */}
      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-body">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-caption">
                <th className="p-3 font-semibold w-16">{t("audit_col_seq", locale)}</th>
                <th className="p-3 font-semibold">{t("audit_col_date", locale)}</th>
                <th className="p-3 font-semibold">{t("audit_col_actor", locale)}</th>
                <th className="p-3 font-semibold">{t("audit_col_action", locale)}</th>
                <th className="p-3 font-semibold">{t("audit_col_target", locale)}</th>
                <th className="p-3 font-semibold">{t("audit_col_details", locale)}</th>
                <th className="p-3 font-semibold text-right">Xesh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t("audit_empty", locale)}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => {
                  const d = new Date(e.at);
                  const dateStr = d.toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-caption text-muted-foreground">#{e.seq}</td>
                      <td className="p-3 font-mono text-caption text-muted-foreground whitespace-nowrap">{dateStr}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <User className="size-3.5 text-muted-foreground" />
                          <span>{e.actorName || e.actorType}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge tone="info" className="font-mono text-2xs">
                          {e.action}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {e.targetType ? (
                          <span className="text-caption font-mono text-foreground">
                            {e.targetType}
                            {e.targetId ? `:${e.targetId.slice(0, 8)}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-2xs font-mono text-muted-foreground max-w-xs truncate">
                        {Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : "-"}
                      </td>
                      <td className="p-3 text-right font-mono text-2xs text-muted-foreground">
                        <span title={e.hash}>{e.hash.slice(0, 8)}...</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

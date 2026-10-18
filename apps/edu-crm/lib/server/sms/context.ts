import "server-only";
import type { TenantDb } from "@ventura/db";
import { type Relay, createRelay } from "@ventura/integrations/relay";
import type { Tenant } from "@ventura/tenants";
import type { SmsProviderView } from "@/lib/sms";
import { tenantDeps } from "../deps";
import { tenantSecret } from "../tenant";
import { eskizFor, getProviderRow, providerView } from "./provider";

/*
 * Markazning SMS konteksti (S4, ADR 0056): rejim (Ventura paketi yoki o'z Eskiz hisobi), relay klienti va brauzerga
 * boradigan holat. Sahifa va amallar shu yerdan oladi — rejim tafsilotini bilmaydi.
 */

/** Ventura paketi: deploy markaz maxfiy sozlamasiga panel manzili va kalitni yozgan bo'lsa */
export function relayFor(tenant: Pick<Tenant, "slug">): Relay | null {
  const cfg = tenantSecret(tenant)?.smsRelay;
  return cfg ? createRelay({ url: cfg.url, slug: tenant.slug, key: cfg.key }) : null;
}

export interface SmsContext {
  db: TenantDb;
  secret: string;
  row: Awaited<ReturnType<typeof getProviderRow>>;
  relay: Relay | null;
  view: SmsProviderView;
}

export async function smsContext(tenant: Tenant): Promise<SmsContext> {
  const deps = tenantDeps(tenant)!;
  const row = await getProviderRow(deps.db);
  const relay = relayFor(tenant);
  return { db: deps.db, secret: deps.secret, row, relay, view: providerView(row, deps.secret, !!relay) };
}

/** Shablon moderatsiyasi: joriy rejim hisobida (Ventura yoki markazning o'z Eskiz'i) */
export interface TemplateModerator {
  submit(text: string): Promise<void>;
  statuses(texts: string[]): Promise<{ text: string; id: number; status: string }[]>;
}

export function moderatorFor(ctx: SmsContext): TemplateModerator | null {
  if (ctx.view.mode === "ventura") {
    const relay = ctx.relay;
    if (!relay) return null;
    return {
      submit: async (text) => void (await relay.submitTemplate(text)),
      statuses: async (texts) => (await relay.templateStatus(texts)).templates,
    };
  }
  const eskiz = eskizFor(ctx.db, ctx.row, ctx.secret);
  if (!eskiz) return null;
  return {
    submit: (text) => eskiz.submitTemplate(text),
    statuses: async (texts) => {
      const wanted = new Set(texts.map((x) => x.trim()));
      return (await eskiz.templates()).filter((x) => wanted.has(x.text.trim()));
    },
  };
}

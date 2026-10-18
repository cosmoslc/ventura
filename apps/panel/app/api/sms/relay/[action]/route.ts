import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { projects } from "@ventura/db/schema/panel";
import { EskizError, eskizDeliveryState, eskizPhone } from "@ventura/integrations/eskiz";
import { RELAY_ACTIONS, RELAY_HEADERS, type RelayErrorCode, verifyRelay } from "@ventura/integrations/relay";
import { smsParts } from "@ventura/integrations/sms-parts";
import { readSecret } from "@ventura/security";
import { deps } from "@/lib/server/deps";
import { venturaEskiz } from "@/lib/server/sms/eskiz";
import {
  activePackages,
  pendingPurchases,
  recordSent,
  release,
  requestPurchase,
  reserve,
  settle,
  walletBalance,
} from "@/lib/server/sms/wallet";

/*
 * Ventura SMS relay (S4, ADR 0056): markaz ilovalari Ventura paketidan SMS yuboradi. Har so'rov loyihaning relay
 * kaliti bilan imzolangan (packages/integrations/src/relay.ts); kalit loyiha sirlarida. Sessiyasiz (proxy.ts PUBLIC).
 * Javobda sir yo'q; Ventura Eskiz xatosi matni markazga qaytadi (unda kalit yo'q).
 */

const fail = (status: number, code: RelayErrorCode, error: string) => NextResponse.json({ error, code }, { status });

const sendInput = z.object({ phone: z.string().min(9).max(20), text: z.string().trim().min(1).max(1000) });
const statusInput = z.object({ providerId: z.string().min(1).max(100) });
const purchaseInput = z.object({ packageId: z.uuid(), requestedBy: z.string().max(120).default("") });
const templateInput = z.object({ text: z.string().trim().min(1).max(1000) });
const templatesInput = z.object({ texts: z.array(z.string().max(1000)).max(200) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!(RELAY_ACTIONS as readonly string[]).includes(action)) return fail(404, "invalid", "Noma'lum amal");

  const { db } = deps();
  const slug = req.headers.get(RELAY_HEADERS.tenant) ?? "";
  const ts = req.headers.get(RELAY_HEADERS.ts) ?? "";
  const sig = req.headers.get(RELAY_HEADERS.sig) ?? "";
  const body = await req.text();
  const [project] = slug
    ? await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
    : [];
  const key = project ? await readSecret(db, { type: "project", id: project.id }, "sms_relay_key") : null;
  if (!project || !key || !verifyRelay({ key, ts, sig, body })) return fail(401, "unauthorized", "Imzo noto'g'ri");

  let payload: unknown;
  try {
    payload = JSON.parse(body || "{}");
  } catch {
    return fail(400, "invalid", "JSON emas");
  }

  if (action === "wallet") {
    const [balance, packages, pending] = await Promise.all([
      walletBalance(db, project.id),
      activePackages(db),
      pendingPurchases(db, project.id),
    ]);
    return NextResponse.json({
      balance,
      packages: packages.map(({ id, name, parts, price }) => ({ id, name, parts, price })),
      pending: pending.map((p) => ({
        id: p.id,
        packageName: p.packageName,
        parts: p.parts,
        price: p.price,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }

  if (action === "purchase") {
    const input = purchaseInput.safeParse(payload);
    if (!input.success) return fail(400, "invalid", "Kirish noto'g'ri");
    const res = await requestPurchase(db, project.id, input.data.packageId, input.data.requestedBy);
    return res ? NextResponse.json(res) : fail(404, "invalid", "Paket topilmadi");
  }

  const ventura = await venturaEskiz(db);
  if (!ventura) return fail(503, "unavailable", "Ventura SMS xizmati hozircha ulanmagan");

  if (action === "template_submit") {
    const input = templateInput.safeParse(payload);
    if (!input.success) return fail(400, "invalid", "Kirish noto'g'ri");
    try {
      await ventura.eskiz.submitTemplate(input.data.text);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return fail(502, "error", e instanceof Error ? e.message : String(e));
    }
  }

  if (action === "template_status") {
    const input = templatesInput.safeParse(payload);
    if (!input.success) return fail(400, "invalid", "Kirish noto'g'ri");
    try {
      // Faqat markaz so'ragan matnlar: Ventura hisobidagi boshqa markazlar shablonlari qaytmaydi
      const wanted = new Set(input.data.texts.map((x) => x.trim()));
      const all = await ventura.eskiz.templates();
      return NextResponse.json({ templates: all.filter((x) => wanted.has(x.text.trim())) });
    } catch (e) {
      return fail(502, "error", e instanceof Error ? e.message : String(e));
    }
  }

  if (action === "status") {
    const input = statusInput.safeParse(payload);
    if (!input.success) return fail(400, "invalid", "Kirish noto'g'ri");
    try {
      const s = await ventura.eskiz.status(input.data.providerId);
      const state = eskizDeliveryState(s.status);
      await settle(db, project.id, input.data.providerId, state, s.parts);
      return NextResponse.json({ state, parts: s.parts });
    } catch (e) {
      return fail(502, "error", e instanceof Error ? e.message : String(e));
    }
  }

  // send
  const input = sendInput.safeParse(payload);
  if (!input.success) return fail(400, "invalid", "Kirish noto'g'ri");
  const phone = eskizPhone(input.data.phone);
  if (!phone) return fail(422, "rejected", "Telefon raqami noto'g'ri");
  const parts = smsParts(input.data.text).parts;
  if (!(await reserve(db, project.id, parts))) return fail(402, "insufficient", "SMS qoldig'i yetmaydi");
  try {
    const sent = await ventura.eskiz.send({ phone, text: input.data.text, from: ventura.sender ?? undefined });
    await recordSent(db, project.id, sent.id, parts);
    return NextResponse.json({ providerId: sent.id, parts });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await release(db, project.id, parts, message);
    const s = e instanceof EskizError ? e.status : undefined;
    const rejected = !!s && s >= 400 && s < 500 && s !== 401 && s !== 429;
    return fail(rejected ? 422 : 502, rejected ? "rejected" : "error", message);
  }
}

import { commit, tenantForHost, tenantSecret } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

/**
 * Deploy tekshiruvi (health check): ilova tirikmi, so'rov domeni qaysi mijozga tegishli va uning bazasi
 * sozlanganmi (`configured` — faqat bor/yo'q, manzil yoki sir qaytarilmaydi).
 */
export function GET(request: Request) {
  const tenant = tenantForHost(request.headers.get("host"));
  return Response.json({
    ok: true,
    tenant: tenant?.slug ?? null,
    commit: commit(),
    configured: tenant ? tenantSecret(tenant) !== null : false,
  });
}

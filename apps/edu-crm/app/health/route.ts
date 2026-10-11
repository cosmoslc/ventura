import { commit, tenantForHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Deploy tekshiruvi (health check): ilova tirikmi va so'rov domeni qaysi mijozga tegishli. */
export function GET(request: Request) {
  const tenant = tenantForHost(request.headers.get("host"));
  return Response.json({ ok: true, tenant: tenant?.slug ?? null, commit: commit() });
}

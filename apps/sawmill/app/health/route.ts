import { commit, tenantForHost, tenantSecret } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const host = request.headers.get("host");
  const tenant = tenantForHost(host);
  const secret = tenant ? tenantSecret(tenant) : null;

  return Response.json({
    ok: true,
    status: "ok",
    app: "sawmill",
    commit: commit(),
    uptime: process.uptime(),
    host,
    tenant: tenant?.slug ?? null,
    tenantSlug: tenant?.slug ?? null,
    configured: tenant ? secret !== null && !!secret.databaseUrl : false,
    hasSecret: !!secret,
    hasDbUrl: !!secret?.databaseUrl,
  });
}

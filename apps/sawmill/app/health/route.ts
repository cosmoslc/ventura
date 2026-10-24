import { commit, tenantForHost, tenantSecret } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const host = request.headers.get("host");
  const tenant = tenantForHost(host);
  const secret = tenant ? tenantSecret(tenant) : null;

  return Response.json({
    status: "ok",
    app: "sawmill",
    commit: commit(),
    uptime: process.uptime(),
    host,
    tenantSlug: tenant?.slug ?? null,
    hasSecret: !!secret,
    hasDbUrl: !!secret?.databaseUrl,
  });
}


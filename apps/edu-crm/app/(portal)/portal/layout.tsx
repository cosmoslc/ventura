import { brandMark } from "@/components/brand";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalShell } from "./portal-shell";

/** O'quvchi portali layouti (ADR 0063). Muallif / Agent: Google Gemini */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  return (
    <PortalShell student={{ name: staff.name }} brand={{ name: tenant.name, mark: brandMark(tenant) }}>
      {children}
    </PortalShell>
  );
}

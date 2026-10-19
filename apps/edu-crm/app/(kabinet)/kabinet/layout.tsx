import { brandMark } from "@/components/brand";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { KabinetShell } from "./kabinet-shell";

/** O'qituvchi kabineti (ADR 0062): faqat o'qituvchi hisobi; admin xodim CRM'ga yo'naltiriladi */
export default async function KabinetLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  return (
    <KabinetShell staff={{ name: staff.name }} brand={{ name: tenant.name, mark: brandMark(tenant) }}>
      {children}
    </KabinetShell>
  );
}

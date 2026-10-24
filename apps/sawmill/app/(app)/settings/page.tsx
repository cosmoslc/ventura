import { SectionPlaceholder } from "@/components/section-placeholder";
import { requireUser } from "@/lib/server/session";

export default async function SettingsPage() {
  await requireUser();

  return (
    <SectionPlaceholder
      title="Sex va tizim sozlamalari"
      stage="S1 Bosqich"
      description="Birliklar (mm/sm/m), foyda hisoblash usuli, kub usuli va til sozlamalari."
    />
  );
}

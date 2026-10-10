import { ROLE_LABELS } from "@ventura/auth";
import { requireViewer } from "@/lib/server/session";
import { PanelShell } from "./panel-shell";

/** Panel sahifalari: faqat to'liq kirgan (parol + Telegram kodi) foydalanuvchilar uchun. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <PanelShell viewer={{ name: viewer.name, role: viewer.role, roleLabel: ROLE_LABELS[viewer.role] }}>
      {children}
    </PanelShell>
  );
}

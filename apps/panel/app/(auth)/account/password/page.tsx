import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../../auth-card";
import { PasswordForm } from "./password-form";

export const metadata = { title: `${uz.auth.passwordTitle} · ${uz.app.name}` };

export default async function PasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const forced = viewer.state === "must_change_password";
  return (
    <AuthCard title={uz.auth.passwordTitle} hint={forced ? uz.auth.passwordForcedHint : uz.auth.passwordHint}>
      <PasswordForm forced={forced} />
    </AuthCard>
  );
}

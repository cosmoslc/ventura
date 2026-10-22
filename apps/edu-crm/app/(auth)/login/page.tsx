import { redirect } from "next/navigation";
import { Notice } from "@ventura/ui/notice";
import { currentDeps, getStaff } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata = { title: uz.auth.loginTitle };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ telegram?: string }> }) {
  const { deps } = await currentDeps();
  const staff = deps ? await getStaff() : null;
  if (staff?.state === "ok") {
    if (staff.kind === "student") redirect("/portal");
    if (staff.kind === "teacher") redirect("/kabinet");
    redirect("/");
  }
  const { telegram } = await searchParams;
  const blocked = !deps ? uz.auth.notConfigured : !deps.telegram ? uz.auth.noBot : null;
  return (
    <AuthCard title={uz.auth.loginTitle} hint={blocked ? undefined : uz.auth.loginHint}>
      {blocked ? (
        <Notice tone="warning">{blocked}</Notice>
      ) : (
        <LoginForm info={telegram === "ulandi" ? uz.auth.linked : undefined} />
      )}
    </AuthCard>
  );
}

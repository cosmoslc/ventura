import { redirect } from "next/navigation";
import { getStaff } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../../auth-card";
import { PasswordForm } from "./password-form";

export const metadata = { title: uz.auth.passwordTitle };

export default async function PasswordPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  const forced = staff.state === "must_change_password";
  return (
    <AuthCard title={uz.auth.passwordTitle} hint={forced ? uz.auth.passwordForcedHint : uz.auth.passwordHint}>
      <PasswordForm forced={forced} />
    </AuthCard>
  );
}

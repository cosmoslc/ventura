import { redirect } from "next/navigation";
import { getStaff } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../auth-card";
import { ConnectForm } from "./connect-form";

export const metadata = { title: uz.auth.connectTitle };

export default async function ConnectTelegramPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (staff.state === "must_change_password") redirect("/account/password");
  if (staff.state === "ok") redirect("/");
  return (
    <AuthCard title={uz.auth.connectTitle} hint={uz.auth.connectHint}>
      <ConnectForm />
    </AuthCard>
  );
}

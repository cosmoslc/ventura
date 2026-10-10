import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../auth-card";
import { ConnectForm } from "./connect-form";

export const metadata = { title: `${uz.auth.connectTitle} · ${uz.app.name}` };

export default async function ConnectTelegramPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.state === "must_change_password") redirect("/account/password");
  if (viewer.state === "ok") redirect("/");
  return (
    <AuthCard title={uz.auth.connectTitle} hint={uz.auth.connectHint}>
      <ConnectForm />
    </AuthCard>
  );
}

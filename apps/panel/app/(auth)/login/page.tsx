import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata = { title: `${uz.auth.loginTitle} · ${uz.app.name}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ telegram?: string }> }) {
  const viewer = await getViewer();
  if (viewer?.state === "ok") redirect("/");
  const { telegram } = await searchParams;
  return (
    <AuthCard title={uz.auth.loginTitle} hint={uz.auth.loginHint}>
      <LoginForm info={telegram === "ulandi" ? uz.auth.linked : undefined} />
    </AuthCard>
  );
}

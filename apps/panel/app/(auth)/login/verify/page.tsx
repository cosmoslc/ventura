import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPending } from "@ventura/auth";
import { PENDING_COOKIE } from "@/lib/server/request";
import { uz } from "@/lib/uz";
import { AuthCard } from "../../auth-card";
import { VerifyForm } from "./verify-form";

export const metadata = { title: `${uz.auth.verifyTitle} · ${uz.app.name}` };

export default async function VerifyPage() {
  // Parol bosqichidan o'tmagan bo'lsa — kirish sahifasiga
  const pending = readPending((await cookies()).get(PENDING_COOKIE)?.value, process.env.BETTER_AUTH_SECRET ?? "");
  if (!pending) redirect("/login");
  return (
    <AuthCard title={uz.auth.verifyTitle} hint={uz.auth.verifyHint}>
      <VerifyForm />
    </AuthCard>
  );
}

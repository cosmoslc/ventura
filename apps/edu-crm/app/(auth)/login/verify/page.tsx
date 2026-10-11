import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPending } from "@ventura/auth";
import { PENDING_COOKIE } from "@/lib/server/request";
import { currentDeps } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { AuthCard } from "../../auth-card";
import { VerifyForm } from "./verify-form";

export const metadata = { title: uz.auth.verifyTitle };

export default async function VerifyPage() {
  // Kirish oralig'i yo'q: yo kod hozirgina tasdiqlangan (amal shu sahifani qayta chizmoqda, yangi sessiya
  // cookie'si hali so'rovda yo'q), yo parol bosqichidan o'tilmagan. Ikkalasida ham "/" to'g'ri joyga olib boradi:
  // kirgan xodim — bosh sahifaga, qolganlar — /login ga.
  const { deps } = await currentDeps();
  const pending = deps ? readPending((await cookies()).get(PENDING_COOKIE)?.value, deps.secret) : null;
  if (!pending) redirect("/");
  return (
    <AuthCard title={uz.auth.verifyTitle} hint={uz.auth.verifyHint}>
      <VerifyForm />
    </AuthCard>
  );
}

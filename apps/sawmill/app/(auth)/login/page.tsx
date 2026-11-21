import { redirect } from "next/navigation";
import { currentSession } from "@/lib/server/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await currentSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
      <LoginForm />
    </div>
  );
}

import type { Metadata } from "next";
import { PauseCircle } from "lucide-react";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

export const metadata: Metadata = {
  title: uz.frozen.tizimToxtatilganVentura,
};

/**
 * Loyiha to'xtatilgan (muzlatilgan) yoki sinov muddati tugagan holatda ko'rsatiladigan sahifa.
 * Muallif / Agent: Google Gemini
 */
export default async function PausedPage() {
  const tenant = await currentTenant();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-card bg-(--warning-bg) text-(--warning-fg) ring-1 ring-(--warning-border)">
          <PauseCircle className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{uz.frozen.tizimToxtatilgan}</h1>
          <p className="text-body text-muted-foreground">
            {tenant?.name ? (
              <span className="font-semibold text-foreground">{tenant.name}</span>
            ) : (
              uz.frozen.ushbuMarkaz
            )}{" "}
            {uz.frozen.tiziminingXizmatKorsatishMuddati}
          </p>
        </div>
        <div className="rounded-card border border-border-soft bg-muted/30 p-4 text-caption text-muted-foreground">
          {uz.frozen.tizimniQaytaFaollashtirishVa}
        </div>
      </div>
    </main>
  );
}

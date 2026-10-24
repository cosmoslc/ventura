import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@ventura/ui/button";

export function SectionPlaceholder({
  title,
  stage,
  description,
}: {
  title: string;
  stage: string;
  description: string;
}) {
  return (
    <div className="rounded-card border border-border bg-card p-8 text-center max-w-lg mx-auto mt-8 shadow-card">
      <div className="size-12 rounded-btn bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
        <Clock className="size-6" />
      </div>
      <h2 className="text-title font-bold text-foreground">{title}</h2>
      <p className="text-caption text-muted-foreground mt-1.5">{description}</p>
      <div className="mt-3 inline-block px-2.5 py-1 rounded-control text-2xs font-bold bg-muted text-muted-foreground font-mono">
        Reja bo'yicha: {stage}
      </div>
      <div className="mt-6">
        <Button asChild variant="subtle">
          <Link href="/">
            <ArrowLeft className="size-4 mr-2" />
            Bosh sahifaga qaytish
          </Link>
        </Button>
      </div>
    </div>
  );
}

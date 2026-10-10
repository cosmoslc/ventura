import { Card, CardContent } from "@ventura/ui/card";

export function AuthCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="type-heading text-lg text-foreground">{title}</h1>
        {hint ? <p className="mt-1 text-body text-muted-foreground">{hint}</p> : null}
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}

export function FormMessage({ error, info }: { error?: string; info?: string }) {
  if (!error && !info) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={
        error
          ? "rounded-control border border-(--danger-border) bg-(--danger-bg) px-3 py-2 text-body text-(--danger-fg)"
          : "rounded-control border border-(--success-border) bg-(--success-bg) px-3 py-2 text-body text-(--success-fg)"
      }
    >
      {error ?? info}
    </div>
  );
}

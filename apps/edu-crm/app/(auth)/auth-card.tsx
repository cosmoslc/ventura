import { Card, CardContent } from "@ventura/ui/card";
import { Notice } from "@ventura/ui/notice";

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
  if (error) return <Notice tone="danger">{error}</Notice>;
  if (info) return <Notice tone="success">{info}</Notice>;
  return null;
}

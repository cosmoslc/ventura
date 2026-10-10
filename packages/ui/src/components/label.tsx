import * as React from "react";
import { cn } from "../lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("type-label mb-1.5 block text-(--label-fg)", className)} {...props} />;
}

export function FieldHint({
  className,
  error,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { error?: boolean }) {
  return (
    <p
      className={cn(
        "mt-1.5 text-xs",
        error ? "font-semibold text-destructive-text" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

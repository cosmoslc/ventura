import * as React from "react";
import { cn } from "../lib/utils";
import { controlClass } from "./input";

/** Ko'p qatorli matn — oddiy input bilan bir xil chegara, radius, padding va fokus. */
export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClass, "h-auto min-h-(--control-h) resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

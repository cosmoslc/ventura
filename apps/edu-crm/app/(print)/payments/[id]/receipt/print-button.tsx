"use client";

import { Printer } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { uz } from "@/lib/uz";

/** `autoPrint` yoqilgan bo'lsa chek ochilishi bilan chop etish oynasi o'zi ochiladi (bir marta) */
export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!autoPrint || done.current) return;
    done.current = true;
    window.print();
  }, [autoPrint]);

  return (
    <div className="flex justify-center print:hidden">
      <Button onClick={() => window.print()}>
        <Printer /> {uz.payments.print}
      </Button>
    </div>
  );
}

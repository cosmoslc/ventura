"use client";

import { Printer } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { uz } from "@/lib/uz";

export function PrintButton() {
  return (
    <div className="flex justify-center print:hidden">
      <Button onClick={() => window.print()}>
        <Printer /> {uz.payments.print}
      </Button>
    </div>
  );
}

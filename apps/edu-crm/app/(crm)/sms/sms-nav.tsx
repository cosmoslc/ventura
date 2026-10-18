"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { uz } from "@/lib/uz";

const LINKS = ["/sms", "/sms/templates"] as const;

/** SMS bo'limi ichidagi sahifalar (umumiy, shablonlar; keyin — hisobot). Tab bosilganda manzil o'zgaradi. */
export function SmsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const active = LINKS.find((h) => h !== "/sms" && pathname.startsWith(h)) ?? "/sms";
  return (
    <Tabs value={active} onValueChange={(v) => startTransition(() => router.push(v))}>
      <TabsList>
        {LINKS.map((h) => (
          <TabsTrigger key={h} value={h}>
            {uz.smsTemplates.nav[h]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

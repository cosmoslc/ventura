import type { Metadata } from "next";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { tenantForHost } from "@/lib/tenant";
import { uz } from "@/lib/uz";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = tenantForHost((await headers()).get("host"));
  return { title: tenant?.name ?? uz.unknownTitle };
}

/** Mijoz brendi: asosiy rang va ko'rinish ro'yxatdan olinadi, qolgan ranglar tokenlarda undan hosil bo'ladi. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = tenantForHost((await headers()).get("host"));
  const style = tenant ? ({ "--primary": tenant.brand.primary } as CSSProperties) : undefined;
  return (
    <html
      lang="uz"
      data-brand="ventura"
      className={tenant?.brand.appearance === "dark" ? "dark" : undefined}
      style={style}
    >
      <body>{children}</body>
    </html>
  );
}

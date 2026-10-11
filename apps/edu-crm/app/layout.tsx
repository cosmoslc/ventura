import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { themeScript } from "@ventura/ui/lib/theme";
import { Toaster } from "@ventura/ui/toast";
import { fontVariables } from "@/lib/fonts";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await currentTenant();
  return { title: tenant?.name ?? uz.unknownTitle, description: uz.app.subtitle };
}

/** Mijoz brendi: asosiy rang ro'yxatdan olinadi, qolgan ranglar tokenlarda undan hosil bo'ladi (SPEC 8). */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();
  const style = tenant ? ({ "--primary": tenant.brand.primary } as CSSProperties) : undefined;
  return (
    <html lang="uz" data-brand="ventura" className={fontVariables} style={style} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(tenant?.brand.appearance) }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

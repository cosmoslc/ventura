import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { themeScript } from "@ventura/ui/lib/theme";
import { Toaster } from "@ventura/ui/toast";
import { fontVariables } from "@/lib/fonts";
import { currentTenant } from "@/lib/server/tenant";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await currentTenant();
  return {
    title: tenant?.name ? `${tenant.name} — Pilorama` : "Pilorama Boshqaruvi",
    description: "Pilorama Boshqaruvi — Yog'och tilish sexi hisob-kitob tizimi",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();
  const style = tenant ? ({ "--primary": tenant.brand.primary } as CSSProperties) : undefined;

  return (
    <html lang="uz" data-brand="ventura" className={fontVariables} style={style} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(tenant?.brand.appearance) }} />
      </head>
      <body className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] antialiased font-[family-name:var(--font-quicksand)]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

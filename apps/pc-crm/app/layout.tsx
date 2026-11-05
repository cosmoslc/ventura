import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { themeInitScript } from "@ventura/ui/lib/theme";
import { Toaster } from "@ventura/ui/toast";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/lib/cart-context";
import { LikedProvider } from "@/lib/liked-context";
import { NotificationProvider } from "@/lib/notification-context";
import { StoreProvider } from "@/lib/store-context";
import { getStoreBranding } from "@/lib/server/branding";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#3f6df6",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getStoreBranding();
  return {
    title: `${branding.name} — Kompyuter va Texnika Do'koni`,
    description: `${branding.name} — Onlayn kompyuter va elektronika do'koni, PC konfigurator va boshqaruv tizimi`,
    icons: branding.logoUrl ? [{ rel: "icon", url: branding.logoUrl }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getStoreBranding();
  const style = branding.primary ? ({ "--primary": branding.primary } as CSSProperties) : undefined;

  return (
    <html lang="uz" data-brand="ventura" className={fontVariables} style={style} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-[family-name:var(--font-quicksand)]">
        <StoreProvider initialBranding={branding}>
          <CartProvider>
            <LikedProvider>
              <NotificationProvider>
                {children}
                <CartDrawer />
                <Toaster />
              </NotificationProvider>
            </LikedProvider>
          </CartProvider>
        </StoreProvider>
      </body>
    </html>
  );
}

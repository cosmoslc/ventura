import type { Metadata } from "next";
import { themeInitScript } from "@ventura/ui/theme-toggle";
import { Toaster } from "@ventura/ui/toast";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ventura · Boshqaruv paneli",
  description: "Ventura boshqaruv paneli: komponentlar ko'rinishi",
};

/** data-brand <html> da turadi — portal (modal, menyu) ham tokenlarni oladi. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-brand="ventura" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

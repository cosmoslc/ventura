// Muallif / Agent: Google Gemini
import type { Metadata } from "next";
import { CrmLanding } from "./crm-landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Ventura CRM · O'quv Markaz Boshqaruv Tizimi | 7 Kun Bepul Sinov",
  description:
    "O'zbekistondagi o'quv markazlari uchun eng ilg'or CRM tizimi. O'quvchi va o'qituvchi kabinetlari, davomat, moliya, Telegram botlar, uy vazifalariga fayl yuklash va alohida xavfsiz baza. 7 kun bepul boshlang!",
  keywords: [
    "crm",
    "ventura",
    "ventura crm",
    "o'quv markaz crm",
    "edu crm",
    "oquv markazi crm",
    "o'quv markaz boshqaruvi",
    "telegram bot crm",
    "davomat crm",
    "o'qituvchi kabineti",
    "o'quvchi kabineti",
    "uy vazifasi crm",
  ],
  authors: [{ name: "Ventura EDU CRM" }],
  openGraph: {
    title: "Ventura CRM · O'quv Markaz Boshqaruv Tizimi",
    description:
      "O'quvchi va o'qituvchi kabinetlari, davomat, moliya, Telegram botlar, uy vazifalariga fayl yuklash va alohida xavfsiz baza. 7 kun bepul boshlang!",
    url: "https://crm.ventura.uz",
    siteName: "Ventura CRM",
    locale: "uz_UZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ventura CRM · O'quv Markaz Boshqaruv Tizimi",
    description:
      "O'quv markazingizni 100% avtomatlashtiring. 7 kunlik to'liq bepul sinov davri. Karta talab etilmaydi.",
  },
  alternates: {
    canonical: "https://crm.ventura.uz",
  },
};

export default function CrmLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Ventura EDU CRM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web Browser, Mobile Browser, Telegram",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "UZS",
      description: "7 kunlik to'liq bepul sinov davri",
    },
    description:
      "O'quv markazlari boshqaruvi uchun keng qamrovli CRM tizimi: o'quvchi va o'qituvchi kabinetlari, moliya, davomat va Telegram bot.",
    featureList: [
      "O'quvchi shaxsiy portali",
      "O'qituvchi kabineti va uy vazifalari fayl tekshiruvi",
      "Shaxsiy Telegram bot ekotizimi",
      "Moliya, kassa va qarzdorlar monitoringi",
      "Xotira va fayllar ombori (10 GB)",
      "Multi-tenant alohida PostgreSQL bazasi",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CrmLanding />
    </>
  );
}

import type { Metadata } from "next";
import { UiCatalog } from "@/components/ui-catalog";

export const metadata: Metadata = {
  title: "Ventura · Komponentlar katalogi",
  description: "packages/ui komponentlari light va dark rejimda",
};

export default function UiPreviewPage() {
  return <UiCatalog />;
}

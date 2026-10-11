import { notFound } from "next/navigation";
import { PreviewScreen } from "@/components/preview-screen";

export default function VenturaPreviewPage() {
  // Faqat ishlab chiqish uchun — production'da ochilmaydi
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewScreen />;
}

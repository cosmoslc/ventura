import { notFound } from "next/navigation";

/** O'chirilgan bo'lim manzillari proxy orqali shu yerga yo'naltiriladi: 404 holati va "topilmadi" sahifasi. */
export default function ClosedSection() {
  notFound();
}

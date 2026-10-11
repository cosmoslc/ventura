import { Hammer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { featureForPath } from "@ventura/tenants";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { features } from "@/lib/manifest";
import { requireFeature } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * Hali yozilmagan bo'limlar uchun vaqtinchalik sahifa (E0). Bo'lim yoqilmagan bo'lsa — 404, ruxsat
 * bo'lmasa — bosh sahifa. E1 dan boshlab har bo'lim o'z papkasini oladi (masalan app/(crm)/students),
 * u shu dinamik manzildan ustun turadi.
 */
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const href = `/${section}`;
  const key = featureForPath(features, href);
  const feature = features.find((f) => f.key === key);
  const link = feature?.nav.find((n) => n.href === href);
  if (!feature || !link) notFound();
  await requireFeature(feature.key);

  return (
    <div>
      <PageHeader title={link.label} description={feature.description} />
      <Card>
        <EmptyState
          icon={<Hammer />}
          title={uz.section.soon}
          description={uz.section.soonHint}
          action={
            <Button variant="ghost" asChild>
              <Link href="/">{uz.section.toHome}</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}

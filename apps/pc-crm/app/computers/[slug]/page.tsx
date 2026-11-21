import { notFound } from "next/navigation";
import { getDbPcBuilds } from "@/lib/server/pcs";
import type { PcBuildItem, PcBuildPublicItem } from "@/lib/pc-data";
import ComputerDetailClient from "./detail-client";

export const dynamic = "force-dynamic";

function toPublicBuild(build: PcBuildItem): PcBuildPublicItem {
  return {
    id: build.id,
    slug: build.slug,
    name: build.name,
    images: build.images,
    sellPrice: build.sellPrice,
    discountPercent: build.discountPercent,
    status: build.status,
    ratingAvg: build.ratingAvg,
    ratingCount: build.ratingCount,
    cpu: build.cpu,
    gpu: build.gpu,
    ram: build.ram,
    storage: build.storage,
    components: build.components.map((component) => ({
      role: component.role,
      roleNameUz: component.roleNameUz,
      productId: component.productId,
      productName: component.productName,
      qty: component.qty,
      imageUrl: component.imageUrl,
      inStock: component.inStock,
    })),
    specs: build.specs,
    description: build.description,
    warrantyMonths: build.warrantyMonths,
  };
}

export default async function ComputerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const builds = await getDbPcBuilds();
  const current = builds.find((build) => build.slug === slug && build.status !== "hidden");
  if (!current) notFound();
  const similarBuilds = builds.filter((build) => build.id !== current.id && build.status === "available").slice(0, 3);

  return <ComputerDetailClient pc={toPublicBuild(current)} similarBuilds={similarBuilds.map(toPublicBuild)} />;
}

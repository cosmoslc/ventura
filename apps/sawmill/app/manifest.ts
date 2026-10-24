import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pilorama Boshqaruvi",
    short_name: "Pilorama",
    description: "Ventura Sawmill — terak, ombor, ish haqi va sotuv hisob-kitob tizimi",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

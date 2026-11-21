import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Monorepo ildizidagi yagona .env (packages/* va tooling/scripts ham shundan foydalanadi)
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const PANEL_HOSTS = ["admin.ventura.uz", "crm.ventura.uz"];

const config: NextConfig = {
  // Production ishlab turganda dev preview alohida papkada (production build'ni o'chirib yubormasin)
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  transpilePackages: [
    "@ventura/ui",
    "@ventura/auth",
    "@ventura/db",
    "@ventura/deploy",
    "@ventura/integrations",
    "@ventura/security",
    "@ventura/tenants",
  ],
  serverExternalPackages: ["postgres", "pg", "pg-boss"],
  devIndicators: false,
  // Panel tunnel orqali ochiladi (ADR 0049): faqat o'z hostlari. *.ventura.uz — mijoz saytlari, ularga ishonilmaydi.
  allowedDevOrigins: PANEL_HOSTS,
  experimental: {
    agentUpgrade: "security",
    serverActions: { allowedOrigins: PANEL_HOSTS },
  },
};

export default config;

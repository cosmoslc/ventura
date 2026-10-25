import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Monorepo ildizidagi yagona .env (packages/* va tooling/scripts ham shundan foydalanadi)
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

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
  experimental: {
    agentUpgrade: "security",
  },
};

export default config;

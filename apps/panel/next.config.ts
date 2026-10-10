import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Monorepo ildizidagi yagona .env (packages/* va tooling/scripts ham shundan foydalanadi)
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  transpilePackages: [
    "@ventura/ui",
    "@ventura/auth",
    "@ventura/db",
    "@ventura/integrations",
    "@ventura/security",
    "@ventura/tenants",
  ],
  serverExternalPackages: ["postgres"],
  devIndicators: false,
};

export default config;

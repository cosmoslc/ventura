import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

const repoRoot = resolve(process.cwd(), "../..");
const rootEnv = resolve(repoRoot, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
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

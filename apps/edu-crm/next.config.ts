import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { NextConfig } from "next";

// Mahalliy ishlab chiqishda monorepo ildizidagi .env (serverda o'zgaruvchilarni PM2 sozlamasi beradi)
const repoRoot = resolve(process.cwd(), "../..");
const rootEnv = resolve(repoRoot, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
// .env dagi nisbiy fayl yo'llari repo ildiziga nisbatan (pnpm edu:tenant ham shunday o'qiydi)
for (const key of ["VENTURA_TENANTS_FILE", "VENTURA_TENANT_SECRETS_FILE"]) {
  const value = process.env[key];
  if (value && !isAbsolute(value)) process.env[key] = resolve(repoRoot, value);
}

const config: NextConfig = {
  // Production ishlab turganda dev preview alohida papkada (production build'ni o'chirib yubormasin)
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

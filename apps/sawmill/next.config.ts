import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { NextConfig } from "next";

const repoRoot = resolve(process.cwd(), "../..");
const rootEnv = resolve(repoRoot, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

for (const key of ["VENTURA_TENANTS_FILE", "VENTURA_TENANT_SECRETS_FILE"]) {
  const value = process.env[key];
  if (value && !isAbsolute(value)) process.env[key] = resolve(repoRoot, value);
}

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

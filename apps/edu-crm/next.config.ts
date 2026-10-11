import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@ventura/ui", "@ventura/tenants"],
  devIndicators: false,
};

export default config;

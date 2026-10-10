import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@ventura/ui"],
  devIndicators: false,
};

export default config;

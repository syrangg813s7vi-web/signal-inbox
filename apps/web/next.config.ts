import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@signal-inbox/ai",
    "@signal-inbox/connectors",
    "@signal-inbox/core",
    "@signal-inbox/db",
    "@signal-inbox/delivery",
    "@signal-inbox/processors",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    devtoolSegmentExplorer: false,
  },
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  transpilePackages: [
    "@signal-inbox/ai",
    "@signal-inbox/capture",
    "@signal-inbox/connectors",
    "@signal-inbox/core",
    "@signal-inbox/db",
    "@signal-inbox/delivery",
    "@signal-inbox/knowledge",
    "@signal-inbox/normalization",
    "@signal-inbox/review",
  ],
};

export default nextConfig;

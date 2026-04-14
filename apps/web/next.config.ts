import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@signal-inbox/ai",
    "@signal-inbox/capture",
    "@signal-inbox/connectors",
    "@signal-inbox/core",
    "@signal-inbox/db",
    "@signal-inbox/knowledge",
    "@signal-inbox/normalization",
    "@signal-inbox/review",
  ],
};

export default nextConfig;

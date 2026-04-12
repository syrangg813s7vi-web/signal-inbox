import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@signal-inbox/capture", "@signal-inbox/core", "@signal-inbox/db"],
};

export default nextConfig;

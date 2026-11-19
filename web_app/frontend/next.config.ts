import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  experimental: { agentUpgrade: "security" },
};

export default nextConfig;

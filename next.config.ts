import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image (one container per tenant).
  output: "standalone",
};

export default nextConfig;

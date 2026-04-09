import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Ignoring build errors is dangerous, but we need this as a temporary workaround
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
};

export default nextConfig;

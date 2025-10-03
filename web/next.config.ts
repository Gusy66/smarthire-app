import type { NextConfig } from "next";
import { withCloudflare } from "@cloudflare/next-on-pages/next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withCloudflare(nextConfig);

import type { NextConfig } from "next";
import { withCloudflare } from "@cloudflare/next-on-pages/next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withCloudflare(nextConfig);

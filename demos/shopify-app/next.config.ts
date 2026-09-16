import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@standhigher/puck-page-builder"],
  env: {
    NEXT_PUBLIC_SHOPIFY_API_KEY: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? process.env.SHOPIFY_API_KEY ?? ""
  }
};

export default nextConfig;

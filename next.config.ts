import { withContentlayer } from "next-contentlayer"
import type { NextConfig } from "next";
import "./env.mjs"

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["avatars.githubusercontent.com", "picsum.photos", "app.reading-advantage"],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default withContentlayer(nextConfig)

import type { NextConfig } from "next"
import { withContentlayer } from "next-contentlayer"

// import "./env.mjs"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      "avatars.githubusercontent.com",
      "picsum.photos",
      "app.reading-advantage",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  fetchBase: {
    development: "http:localhost:3000/api",
    production: "https:example.com/api",
  },
}

export default withContentlayer(nextConfig)

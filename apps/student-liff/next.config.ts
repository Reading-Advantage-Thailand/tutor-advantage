import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/learning/:path*",
        destination: "http://localhost:3002/v1/:path*",
      },
      {
        source: "/api/identity/:path*",
        destination: "http://localhost:3001/v1/:path*",
      },
    ];
  },
  experimental: {
    // @ts-ignore
    allowedDevOrigins: ["*.ngrok-free.app", "localhost:3000"],
  },
};

export default nextConfig;

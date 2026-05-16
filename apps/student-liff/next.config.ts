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
      {
        source: "/api/finance/:path*",
        destination: "http://localhost:3003/v1/:path*",
      },
      {
        source: "/socket.io",
        destination: "http://localhost:3002/socket.io",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3002/socket.io/:path*",
      },
    ];
  },
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "localhost:3000", "localhost:3004"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

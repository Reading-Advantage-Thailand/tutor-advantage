import type { NextConfig } from "next";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const LEARNING_URL = process.env.LEARNING_SERVICE_URL || "http://localhost:3002";
const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";
const FINANCE_URL  = process.env.FINANCE_SERVICE_URL  || "http://localhost:3003";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/learning/:path*",
        destination: `${LEARNING_URL}/v1/:path*`,
      },
      {
        source: "/api/identity/:path*",
        destination: `${IDENTITY_URL}/v1/:path*`,
      },
      {
        source: "/api/finance/:path*",
        destination: `${FINANCE_URL}/v1/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${LEARNING_URL}/socket.io`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${LEARNING_URL}/socket.io/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "localhost:3000", "localhost:3004"],
  // /_next/image fetches and decodes these on the server, so list only the
  // hosts we really show (LINE and Google profile pictures, our content
  // bucket). A "**" wildcard let anyone feed the optimizer their own files.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.line-scdn.net" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/tutor_advantage_bucket/**" },
    ],
  },
};

export default nextConfig;

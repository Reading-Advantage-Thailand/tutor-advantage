// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // PDF templates are server-side generation inputs, not app-shell assets.
  // Precaching them makes every visitor download the blank 50 Tawi form,
  // including unauthenticated users on the login page.
  publicExcludes: ["!documents/**/*"],
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // Authenticated API responses (including generated tax documents) must
    // never be persisted in the shared service-worker cache.
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url }) =>
          sameOrigin && url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: {
          cacheName: "apis",
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = withPWA(nextConfig);

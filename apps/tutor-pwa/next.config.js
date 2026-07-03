// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // PDF templates are server-side generation inputs, not app-shell assets.
  // Precaching them makes every visitor download the blank 50 Tawi form,
  // including unauthenticated users on the login page.
  exclude: [/documents\//],
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

module.exports = withSerwist(nextConfig);

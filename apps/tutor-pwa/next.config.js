// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Precache only the app shell from public/: icons + manifest. public/games
  // (~240 MB of game art/audio) is cached at runtime on first use (see sw.ts),
  // and public/documents + public/fonts are server-side PDF inputs.
  globPublicPatterns: ["icons/**/*", "manifest.json"],
  // Build artefacts that must never be precached.
  exclude: [/documents\//, /\.map$/, /^manifest.*\.js$/],
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

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  RangeRequestsPlugin,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Precache = app shell only (Next build chunks + public icons/manifest, see
 * `globPublicPatterns` in next.config.js). Game art/audio (public/games, ~240 MB)
 * is NOT precached any more: it is cached on first use (CacheFirst + LRU expiry),
 * so installing the PWA no longer downloads every game for every tutor.
 *
 * `cacheId` changed from the default ("serwist") to "tutor-pwa", so the old
 * precache (which held all game assets) is now "outdated" and is deleted on
 * activate by `cleanupOutdatedCaches`.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  cacheId: "tutor-pwa",
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Authenticated JSON/data routes are never cached by the worker.
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      // Game sprites, backgrounds, music and SFX: immutable per path, large.
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/games/"),
      handler: new CacheFirst({
        cacheName: "game-assets",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new RangeRequestsPlugin(),
          new ExpirationPlugin({
            maxEntries: 400,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      // Server-side PDF inputs (50 Tawi template, Thai fonts): never cache.
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && (url.pathname.startsWith("/documents/") || url.pathname.startsWith("/fonts/")),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

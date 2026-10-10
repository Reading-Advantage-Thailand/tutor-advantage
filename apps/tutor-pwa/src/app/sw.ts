import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Preload fires a second request for the same navigation. For /api/auth/*
  // that means two random oauth_state values and a state_mismatch on callback.
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

// navigationPreload is persisted on the registration, so omitting enable() does
// not turn it off for browsers that already have it on. Disable it explicitly.
self.addEventListener("activate", (event) => {
  if (self.registration.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.disable());
  }
});

serwist.addEventListeners();

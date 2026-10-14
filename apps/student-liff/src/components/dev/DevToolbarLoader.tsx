"use client";

import dynamic from "next/dynamic";

/**
 * Dev-only loader for <DevToolbar>. In production builds the condition is a
 * compile-time `false`, so the dynamic import (and the whole DevToolbar
 * module) is dead code and never reaches a client chunk. In development the
 * toolbar loads lazily on the client only.
 */
const DevToolbar =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("./DevToolbar").then((m) => m.DevToolbar), { ssr: false })
    : null;

export function DevToolbarLoader() {
  return DevToolbar ? <DevToolbar /> : null;
}

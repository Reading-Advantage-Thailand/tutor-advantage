import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Route-level locale namespaces are loaded per route (see lib/i18n.ts): any
 * file that holds a "<ns>.<key>" literal for a non-core namespace must import
 * "@/locales/th/<ns>" itself, so the strings are registered wherever that
 * module (and therefore the key) is loaded — server or client.
 */
const SRC = join(__dirname, "..");
const CORE = new Set(["api", "shell"]);
const NAMESPACES = readdirSync(join(SRC, "locales/th"))
  .filter((file) => file.endsWith(".ts") && file !== "docsCopy.ts")
  .map((file) => file.replace(/\.ts$/, ""))
  .filter((ns) => !CORE.has(ns));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("admin-console i18n namespace registration", () => {
  it("every file using a route namespace imports its locale module", () => {
    const keyPattern = new RegExp(`["'\`](${NAMESPACES.join("|")})\\.[A-Za-z_$]`, "g");
    const missing: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      if (rel.startsWith("locales/") || rel === "lib/i18n.ts") continue;
      const source = readFileSync(file, "utf8");
      const used = new Set([...source.matchAll(keyPattern)].map((match) => match[1]));
      for (const ns of used) {
        if (!source.includes(`"@/locales/th/${ns}"`)) missing.push(`${rel} → import "@/locales/th/${ns}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every route locale module registers itself", () => {
    for (const ns of NAMESPACES) {
      const source = readFileSync(join(SRC, "locales/th", `${ns}.ts`), "utf8");
      expect(source, ns).toContain(`registerMessages("${ns}", ${ns});`);
    }
  });
});

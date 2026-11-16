#!/usr/bin/env node
/**
 * Redesign 2026-11 sweep inventory (README §8 step 2): counts the raw Tailwind
 * palette classes, raw hex colours and `text-white` per route in
 * apps/tutor-pwa/src (UI code: no /api routes), outside the six games' folders, and writes
 * src/app/dev/ui-kit/sweep-inventory.json for the /dev/ui-kit checklist.
 * A route is migrated when its counts are zero.
 *
 *   node apps/tutor-pwa/scripts/sweep-inventory.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(APP, "src");
const OUT = join(SRC, "app", "dev", "ui-kit", "sweep-inventory.json");

// Games keep their own art (byte-identical across apps): never swept.
const EXCLUDED_DIRS = [join(SRC, "components", "games"), join(SRC, "lib", "games")];

const PALETTE =
  /(?<![\w-])(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|decoration|divide|placeholder|caret|accent|fill|stroke|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?(?![\w-])/g;
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const TEXT_WHITE = /(?<![\w-])(?:[a-z0-9-]+:)*text-white(?![\w-])/g;

// README §5 item 4: tutor files that put text-white on a brand fill.
const TEXT_WHITE_ON_BRAND = [
  "components/ui/button.tsx",
  "components/ui/checkbox.tsx",
  "components/app/SideNav.tsx",
  "components/app/NotificationBell.tsx",
  "app/(dashboard)/lesson/[id]/interactive/presenter/primitives.tsx",
  "app/(dashboard)/lesson/[id]/interactive/presenter/GamePhaseStage.tsx",
  "app/(dashboard)/lesson/[id]/interactive/ArticleDisplay.tsx",
];

// Files whose hex values are artwork, not UI colour (counted, flagged as allowed).
const ART = ["components/mascot/ReedyMini.tsx"];

function walk(dir, files = []) {
  if (EXCLUDED_DIRS.some((excluded) => dir === excluded || dir.startsWith(excluded + sep))) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.[jt]sx?$/.test(name)) files.push(full);
  }
  return files;
}

/** Nearest folder with a page/layout/route file = the route that ships this code. */
function routeOf(file) {
  const rel = relative(SRC, file).split(sep);
  if (rel[0] !== "app") return `shared: ${rel.slice(0, Math.min(rel.length - 1, 2)).join("/") || rel[0]}`;
  let dir = dirname(file);
  while (dir.startsWith(join(SRC, "app"))) {
    if (["page.tsx", "layout.tsx", "route.ts", "page.ts"].some((entry) => existsSync(join(dir, entry)))) break;
    dir = dirname(dir);
  }
  const segments = relative(join(SRC, "app"), dir)
    .split(sep)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return "/" + segments.join("/");
}

/** Drops block and line comments (not "://" in URLs) so documentation never counts. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<![:"'`\\])\/\/.*$/gm, "");
const count = (text, re) => (stripComments(text).match(re) ?? []).length;

const routes = new Map();
const totals = { files: 0, palette: 0, hex: 0, textWhite: 0 };
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  const rel = relative(SRC, file).split(sep).join("/");
  const palette = count(text, PALETTE);
  const hex = ART.includes(rel) ? 0 : count(text, HEX);
  const textWhite = count(text, TEXT_WHITE);
  if (rel === "app/dev/ui-kit/sweep-inventory.json") continue;
  const route = routeOf(file);
  if (route.startsWith("/api/")) continue; // server routes: no UI colour
  const entry = routes.get(route) ?? { route, files: 0, palette: 0, hex: 0, textWhite: 0, worst: [] };
  entry.files += 1;
  entry.palette += palette;
  entry.hex += hex;
  entry.textWhite += textWhite;
  if (palette + hex + textWhite > 0) entry.worst.push({ file: rel, palette, hex, textWhite });
  routes.set(route, entry);
  totals.files += 1;
  totals.palette += palette;
  totals.hex += hex;
  totals.textWhite += textWhite;
}

const list = [...routes.values()]
  .map((entry) => ({
    ...entry,
    worst: entry.worst.sort((a, b) => b.palette + b.hex + b.textWhite - (a.palette + a.hex + a.textWhite)).slice(0, 3),
  }))
  .sort((a, b) => b.palette + b.hex + b.textWhite - (a.palette + a.hex + a.textWhite) || a.route.localeCompare(b.route));

const textWhiteOnBrand = TEXT_WHITE_ON_BRAND.map((rel) => {
  const full = join(SRC, ...rel.split("/"));
  const remaining = existsSync(full) ? count(readFileSync(full, "utf8"), TEXT_WHITE) : 0;
  return { file: rel, remaining };
});

const result = {
  generatedAt: new Date().toISOString(),
  scope: "apps/tutor-pwa/src (*.ts, *.tsx, *.js), excluding src/components/games, src/lib/games and *.test.*",
  art: ART,
  totals,
  textWhiteOnBrand,
  routes: list,
};
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
console.log(
  `sweep inventory: ${totals.files} files, ${totals.palette} palette classes, ${totals.hex} hex, ${totals.textWhite} text-white → ${relative(APP, OUT)}`,
);

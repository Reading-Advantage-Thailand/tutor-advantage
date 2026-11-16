// Colour-sweep inventory for /dev/ui-kit (redesign 2026-11, README §8 step 2).
//
// Counts, per route (outside the six games), what still bypasses the semantic
// tokens:
//   - palette: raw Tailwind palette classes with a shade, e.g. bg-emerald-600,
//     text-slate-950/80, from-sky-500 (any variant prefix)
//   - whiteBlack: raw white/black colour classes, e.g. text-white, bg-black/50
//   - hex: raw hex colours (#fff, #06c755) in .ts/.tsx/.css (globals.css is the
//     token source and is not counted)
//   - artHex: hex inside mascot / logo artwork (Reedy keeps his own colours,
//     LINE its official logo), reported separately and never swept
//   - textWhiteOnBrand: text-white on the same line as a brand/danger fill
// Comment lines are ignored. A route is migrated when its counts are zero.
//
// Usage (from apps/student-liff):  node scripts/sweep-inventory.mjs
// Writes src/app/dev/ui-kit/sweepInventoryData.ts (static data for the gallery).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(appRoot, "src");
const outFile = join(srcRoot, "app", "dev", "ui-kit", "sweepInventoryData.ts");

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTIL =
  "bg|text|border|border-[trblxy]|ring|ring-offset|from|via|to|fill|stroke|outline|shadow|divide|placeholder|decoration|accent|caret";
const paletteRe = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:${UTIL})-(?:${PALETTE})-(?:50|[1-9]00|950)(?:\\/\\d+)?(?![\\w-])`, "g");
const whiteBlackRe = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:${UTIL})-(?:white|black)(?:\\/\\d+)?(?![\\w-])`, "g");
const hexRe = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const brandFill = "bg-(?:brand-solid|brand-[5-9]00|danger-solid|gradient-brand)";
const textWhiteOnBrandRe = new RegExp(`text-white(?![\\w/-]).*${brandFill}|${brandFill}.*text-white(?![\\w/-])`);

// The six games and their runtime keep their own art: never counted.
const isGameFile = (rel) => /(^|\/)games(-runtime)?(\/|$)/.test(rel);
// Artwork that keeps its own colours (not UI chrome): Reedy and the LINE logo.
const ART_FILES = new Set([
  "components/mascot/ReedyMini.tsx",
  "components/icons/LineIcon.tsx",
  "app/voice-practice/Reedy.tsx",
  "app/voice-practice/reedy.module.css",
]);
const isSkipped = (rel) =>
  isGameFile(rel) ||
  rel === "app/globals.css" ||
  // The inventory itself (its data and the panel that names the class strings it counts).
  rel.startsWith("app/dev/ui-kit/sweepInventoryData") ||
  rel.startsWith("app/dev/ui-kit/SweepInventoryPanel") ||
  /\.test\.(ts|tsx)$/.test(rel);
const stripComments = (text) =>
  text
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx?|css)$/.test(name)) files.push(full);
  }
  return files;
}

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** A folder is a route when it (or one of its route-group children) has a page.tsx. */
function hasPage(dir) {
  if (isFile(join(dir, "page.tsx"))) return true;
  try {
    return readdirSync(dir).some((name) => /^\(.*\)$/.test(name) && isFile(join(dir, name, "page.tsx")));
  } catch {
    return false;
  }
}

/** Route for a file: nearest ancestor route folder under src/app (route groups stripped). */
function routeOf(rel) {
  const parts = rel.split("/");
  if (parts[0] !== "app") {
    // Shared code: group by its first two folders (components/mobile, lib, hooks…).
    return parts[0] === "components" && parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  // Root layout, not-found, providers… are app-wide, not the "/" landing route.
  if (parts.length === 2 && parts[1] !== "page.tsx") return "app (shared)";
  for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
    const dir = join(srcRoot, ...parts.slice(0, depth));
    if (hasPage(dir)) {
      const segments = parts.slice(1, depth).filter((segment) => !/^\(.*\)$/.test(segment));
      return `/${segments.join("/")}`;
    }
  }
  return "app (shared)";
}

const rows = new Map();
for (const full of walk(srcRoot)) {
  const rel = relative(srcRoot, full).split(sep).join("/");
  if (isSkipped(rel)) continue;
  const text = stripComments(readFileSync(full, "utf8"));
  const art = ART_FILES.has(rel);
  const palette = (text.match(paletteRe) ?? []).length;
  const whiteBlack = (text.match(whiteBlackRe) ?? []).length;
  const hexCount = (text.match(hexRe) ?? []).length;
  const hex = art ? 0 : hexCount;
  const artHex = art ? hexCount : 0;
  const textWhiteOnBrand = text.split("\n").filter((line) => textWhiteOnBrandRe.test(line)).length;
  if (!palette && !whiteBlack && !hex && !artHex && !textWhiteOnBrand) continue;
  const route = routeOf(rel);
  const row = rows.get(route) ?? { route, palette: 0, whiteBlack: 0, hex: 0, artHex: 0, textWhiteOnBrand: 0, files: [] };
  row.palette += palette;
  row.whiteBlack += whiteBlack;
  row.hex += hex;
  row.artHex += artHex;
  row.textWhiteOnBrand += textWhiteOnBrand;
  row.files.push(rel);
  rows.set(route, row);
}

const debt = (row) => row.palette + row.whiteBlack + row.hex + row.textWhiteOnBrand;
const list = [...rows.values()].sort((a, b) => debt(b) - debt(a) || a.route.localeCompare(b.route));
const totals = list.reduce(
  (sum, row) => ({
    palette: sum.palette + row.palette,
    whiteBlack: sum.whiteBlack + row.whiteBlack,
    hex: sum.hex + row.hex,
    artHex: sum.artHex + row.artHex,
    textWhiteOnBrand: sum.textWhiteOnBrand + row.textWhiteOnBrand,
  }),
  { palette: 0, whiteBlack: 0, hex: 0, artHex: 0, textWhiteOnBrand: 0 },
);

const header = `// GENERATED by scripts/sweep-inventory.mjs — do not edit by hand.
// Re-run from apps/student-liff: node scripts/sweep-inventory.mjs
// Raw Tailwind palette classes, raw white/black classes, raw hex colours and
// text-white-on-brand lines per route, outside the six games (README §8 step 2).
`;
const body = `export interface SweepRow {
  route: string;
  palette: number;
  whiteBlack: number;
  hex: number;
  artHex: number;
  textWhiteOnBrand: number;
  files: string[];
}

export const SWEEP_GENERATED_AT = ${JSON.stringify(new Date().toISOString().slice(0, 10))};

export const SWEEP_TOTALS = ${JSON.stringify(totals)} as const;

export const SWEEP_ROWS: SweepRow[] = ${JSON.stringify(list, null, 2)};
`;
writeFileSync(outFile, header + body);
console.log(`routes: ${list.length}`, totals);

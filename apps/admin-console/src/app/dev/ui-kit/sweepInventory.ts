import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Redesign sweep inventory (README §5 item 4 and §8 step 2), generated from the
 * source tree each time /dev/ui-kit renders (dev only). Counts, per route
 * folder under src/app (plus the shared src/components):
 * - `text-white` (must become text-on-brand on brand fills),
 * - raw Tailwind palette classes (bg-emerald-600 …),
 * - raw hex colours (#14883b …).
 * A route is migrated when all three are zero. Comment lines are ignored;
 * games folders and tests are excluded (games keep their own art).
 */

export interface SweepFile {
  file: string;
  textWhite: number;
  palette: number;
  hex: number;
}

export interface SweepRoute {
  route: string;
  files: number;
  textWhite: number;
  palette: number;
  hex: number;
  offenders: SweepFile[];
}

export interface SweepInventory {
  routes: SweepRoute[];
  /** README §5 item 4: the admin files that had text-white on a brand fill. */
  brandFiles: SweepFile[];
  totals: { files: number; textWhite: number; palette: number; hex: number };
}

const TEXT_WHITE = /\btext-white\b/g;
const PALETTE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/** README §5 item 4, admin-console. */
export const BRAND_FILL_FILES = [
  "components/ui/button.tsx",
  "components/ui/checkbox.tsx",
  "components/app/SideNav.tsx",
  "components/app/CountBadge.tsx",
] as const;

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "games") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function count(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function scan(path: string, srcRoot: string): SweepFile {
  const code = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");
  return {
    file: relative(srcRoot, path).split(sep).join("/"),
    textWhite: count(code, TEXT_WHITE),
    palette: count(code, PALETTE),
    hex: count(code, HEX),
  };
}

function routeOf(file: string): string {
  if (file.startsWith("components/")) return "components (shared)";
  const parts = file.split("/");
  // app/<segment>/… → "/<segment>"; files directly in app/ → "/" (root layout, not-found, error…)
  return parts.length > 2 ? `/${parts[1]}` : "/";
}

export function buildSweepInventory(srcRoot = join(process.cwd(), "src")): SweepInventory {
  const files = [...sourceFiles(join(srcRoot, "app")), ...sourceFiles(join(srcRoot, "components"))].map((path) => scan(path, srcRoot));
  const byRoute = new Map<string, SweepRoute>();
  for (const file of files) {
    const key = routeOf(file.file);
    const route = byRoute.get(key) ?? { route: key, files: 0, textWhite: 0, palette: 0, hex: 0, offenders: [] };
    route.files += 1;
    route.textWhite += file.textWhite;
    route.palette += file.palette;
    route.hex += file.hex;
    if (file.textWhite || file.palette || file.hex) route.offenders.push(file);
    byRoute.set(key, route);
  }
  const routes = [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));
  const brandFiles = BRAND_FILL_FILES.map(
    (file) => files.find((entry) => entry.file === file) ?? { file, textWhite: 0, palette: 0, hex: 0 },
  );
  const totals = routes.reduce(
    (sum, route) => ({
      files: sum.files + route.files,
      textWhite: sum.textWhite + route.textWhite,
      palette: sum.palette + route.palette,
      hex: sum.hex + route.hex,
    }),
    { files: 0, textWhite: 0, palette: 0, hex: 0 },
  );
  return { routes, brandFiles, totals };
}

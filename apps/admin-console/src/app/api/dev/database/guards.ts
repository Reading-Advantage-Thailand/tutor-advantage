/**
 * Pure guards for the dev database tool (unit-tested; no Next/Prisma imports).
 */

export interface FkEdge {
  /** "schema.table" that holds the foreign key. */
  child: string;
  /** "schema.table" it references. */
  parent: string;
}

/**
 * Every table TRUNCATE … CASCADE empties for `targets`: the targets plus,
 * transitively, every table with a foreign key to one of them.
 */
export function cascadeClosure(targets: readonly string[], edges: readonly FkEdge[]): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const { child, parent } of edges) {
    const list = childrenOf.get(parent) ?? [];
    list.push(child);
    childrenOf.set(parent, list);
  }
  const seen = new Set<string>(targets);
  const queue = [...targets];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenOf.get(current) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return Array.from(seen).sort();
}

/** Database name from a Postgres URL ("postgresql://u:p@h:5432/tutor_local?schema=x" → "tutor_local"). */
export function databaseNameFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return name || null;
  } catch {
    return null;
  }
}

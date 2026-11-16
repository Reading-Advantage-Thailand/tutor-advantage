import { TablePageSkeleton } from "./TablePageSkeleton";

/** Settlements list: header + count tabs + table (the count tabs replace the KPI tiles, patterns.md A2). */
export default function Loading() {
  return <TablePageSkeleton columns={6} />;
}

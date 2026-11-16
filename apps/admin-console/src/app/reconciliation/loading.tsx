import { TablePageSkeleton } from "../settlements/TablePageSkeleton";

/** Reconciliation: header + KPI strip + view tabs + toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton kpi columns={6} />;
}

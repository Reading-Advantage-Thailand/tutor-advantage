import { TablePageSkeleton } from "../settlements/TablePageSkeleton";

/** Fraud flags: header + KPI strip + toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton kpi columns={6} />;
}

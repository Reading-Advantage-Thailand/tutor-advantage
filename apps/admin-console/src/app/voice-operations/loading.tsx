import { TablePageSkeleton } from "@/app/audit/_components/TablePageSkeleton";

/** Voice operations: header with the period tabs, KPI strip, cost card, sessions table. */
export default function Loading() {
  return <TablePageSkeleton actions kpis={4} card toolbar={false} columns={6} />;
}

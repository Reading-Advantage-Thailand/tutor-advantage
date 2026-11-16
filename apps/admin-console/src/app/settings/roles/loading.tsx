import { TablePageSkeleton } from "@/app/audit/_components/TablePageSkeleton";

/** Staff roles: header with "เพิ่มเจ้าหน้าที่", KPI strip (3), search, table. */
export default function Loading() {
  return <TablePageSkeleton actions kpis={3} columns={5} />;
}

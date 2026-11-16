import { TablePageSkeleton } from "./_components/TablePageSkeleton";

/** Audit log: header with "ส่งออก CSV", search + filters, compact table. */
export default function Loading() {
  return <TablePageSkeleton actions columns={6} />;
}

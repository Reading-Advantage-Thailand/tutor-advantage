import { TablePageSkeleton } from "@/app/audit/_components/TablePageSkeleton";

/** Ticket queue: header, status count tabs + search, table. */
export default function Loading() {
  return <TablePageSkeleton tabs columns={7} />;
}

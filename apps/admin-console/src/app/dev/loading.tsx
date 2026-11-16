import { TablePageSkeleton } from "@/app/audit/_components/TablePageSkeleton";

/** Dev users: header with "เพิ่มผู้ใช้", role count tabs + search, table. */
export default function Loading() {
  return <TablePageSkeleton actions tabs columns={7} />;
}

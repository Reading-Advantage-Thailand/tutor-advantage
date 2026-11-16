import { TablePageSkeleton } from "../../settlements/TablePageSkeleton";

/** Exceptions: header + count-tab toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton columns={6} />;
}

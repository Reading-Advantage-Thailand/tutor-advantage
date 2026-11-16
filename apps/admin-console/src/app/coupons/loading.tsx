import { TablePageSkeleton } from "../classes/components/TablePageSkeleton";

/** Coupons: header + KPI strip + status count tabs/search toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton stats columns={7} />;
}

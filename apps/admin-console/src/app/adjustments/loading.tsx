import { TablePageSkeleton } from "../settlements/TablePageSkeleton";

/** Adjustments: header + maker-checker notice + toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton notice columns={6} />;
}

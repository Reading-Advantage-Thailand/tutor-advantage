import { TablePageSkeleton } from "./components/TablePageSkeleton";

/** Classes: header + setup tabs/search toolbar + table. */
export default function Loading() {
  return <TablePageSkeleton columns={6} />;
}

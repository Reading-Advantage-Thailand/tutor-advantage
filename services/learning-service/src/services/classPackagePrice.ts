/** Enrollment buys the original class book; later book upgrades have their own price. */
export function originalPackagePrice(
  cls: { bookId: string; packagePriceMinor: bigint },
  cycles: Array<{ bookId: string; packagePriceMinor: bigint }>,
) {
  return cycles.find((cycle) => cycle.bookId === cls.bookId)?.packagePriceMinor ?? cls.packagePriceMinor;
}

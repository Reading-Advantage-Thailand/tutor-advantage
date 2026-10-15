/**
 * Default class package price (one book), in satang: ฿3,000.
 * Changed from ฿2,500 on 2026-10-15. Applies to classes and book cycles
 * created from then on; existing classes keep the price they were opened at.
 * The DB column defaults (classes / class_book_cycles.package_price_minor)
 * and the tutor/student app fallbacks use the same value.
 */
export const DEFAULT_PACKAGE_PRICE_SATANG = 300_000;

/**
 * One line of text in a table cell that gives way when the card is short of
 * room (coupon and discount-code notes, tutor, class and admin names).
 *
 * `truncate` (nowrap) holds the column at the text's full width up to its
 * max-w cap, so a few long names push the row actions off the card at 1280.
 * This clamp looks the same (one line, ellipsis), but its min-content is only
 * the 64px floor: the table narrows these cells first, and scrolls inside its
 * card only once every one of them is at the floor. Pair it with a max-w-*
 * cap (how much shows when there is room) and a `title` with the full value.
 */
export const CELL_CLAMP = "line-clamp-1 min-w-16 break-all";

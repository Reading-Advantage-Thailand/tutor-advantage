/**
 * Plain constants shared by server and client code. (Constants exported from
 * a "use client" module reach server components only as client references,
 * so anything a server component needs lives here.)
 */

/** Cookie that remembers the collapsed (rail) desktop sidebar; read by the root layout. */
export const SIDEBAR_COOKIE = "admin_sidebar";

/** Poll interval of the shared admin summary (sidebar badges + overview). */
export const ADMIN_SUMMARY_POLL_MS = 60_000;

/**
 * Shared form-control styling (components.md §8): --ctl-h 36 desktop / 44 on
 * touch (callers add h-9 pointer-coarse:h-11), radius 8, 1px --field-border,
 * 14px text (16px on touch, globals.css). Focus = the global 3px --focus-ring
 * outline plus the border turning --brand-fg; invalid = --danger-solid border.
 */
export const fieldControlClass =
  "w-full min-w-0 rounded-(--radius-field) border border-field-border bg-surface px-3 text-sm text-fg transition-[border-color] duration-(--duration-fast) placeholder:text-fg-subtle " +
  "focus-visible:border-brand-fg " +
  "disabled:cursor-not-allowed disabled:opacity-45 " +
  "aria-[invalid=true]:border-danger-solid";

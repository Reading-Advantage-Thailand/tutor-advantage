/**
 * Plain constants shared by server and client code. (Constants exported from
 * a "use client" module reach server components only as client references,
 * so anything a server component needs lives here.)
 */

/** Cookie that remembers the collapsed (rail) desktop sidebar; read by the root layout. */
export const SIDEBAR_COOKIE = "admin_sidebar";

/** Poll interval of the shared admin summary (sidebar badges + overview). */
export const ADMIN_SUMMARY_POLL_MS = 60_000;

/** Shared form-control styling (36px desktop, 44px on touch). Use for custom controls. */
export const fieldControlClass =
  "w-full min-w-0 rounded-lg border border-field-border bg-surface px-3 text-sm text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle " +
  "focus-visible:border-brand-vivid focus-visible:ring-3 focus-visible:ring-brand-vivid/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 " +
  "aria-[invalid=true]:border-danger-fg aria-[invalid=true]:focus-visible:ring-danger-fg/20";

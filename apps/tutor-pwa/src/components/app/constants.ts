/**
 * Plain constants shared by server and client code. (Constants exported from
 * a "use client" module reach server components only as client references,
 * so anything a server component needs lives here.)
 */

/** Cookie that remembers the collapsed (rail) desktop sidebar; read by the dashboard layout. */
export const SIDEBAR_COOKIE = "tutor_sidebar";

/** LINE OA help link used in the account menus. */
export const HELP_URL = "https://lin.ee/5LRn0YM";

/**
 * Shared form-control styling (components.md §8, tutor): radius 12, 1px
 * --field-border, 16px text (15 on desktop). Callers set the height (44
 * desktop, 48 on touch). Focus: the border turns --brand-fg plus the 3px blue
 * focus ring; invalid fields keep a --danger-solid border. Read-only
 * (`readOnly`) is a muted fill at full opacity; disabled is .45.
 */
export const fieldControlClass =
  "w-full min-w-0 rounded-(--radius-field) border border-field-border bg-surface px-3 text-base text-fg outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-fg-subtle lg:text-[0.9375rem] " +
  "focus-visible:border-brand-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-45 [&[readonly]]:bg-surface-muted " +
  "aria-[invalid=true]:border-danger-solid aria-[invalid=true]:focus-visible:border-danger-solid";

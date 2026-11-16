// Relative: the root vitest config maps "@" to tutor-pwa, which has no thaiText.
import { keepThaiWords, thaiCopy } from "../../../lib/thaiText";
import { cn } from "@/lib/utils";

/** The keep-together list now lives in @/lib/thaiText (shared with the state components). */
export { keepThaiWords };

/**
 * Short Thai copy (a notice, an error, a status description): balanced lines,
 * no one-word last line and no compound split across lines (patterns.md
 * "Thai text"). Renders a block <span>, so it fits inside a <p>.
 */
export function ThaiText({ text, className }: { text: string; className?: string }) {
  return <span className={cn("block text-balance", className)}>{thaiCopy(text)}</span>;
}

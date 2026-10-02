/**
 * Pure scroll rules for the chat room message list, so polling never yanks a
 * student who scrolled up to read older messages.
 */

/** Within this many px of the bottom counts as "reading the newest messages". */
export const NEAR_BOTTOM_PX = 80;

export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export function distanceFromBottom({ scrollHeight, scrollTop, clientHeight }: ScrollMetrics): number {
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

export function isNearBottom(metrics: ScrollMetrics, threshold: number = NEAR_BOTTOM_PX): boolean {
  return distanceFromBottom(metrics) <= threshold;
}

/**
 * - "jump": first time messages are on screen → instant scroll to the bottom.
 * - "smooth": a new last message and the student is at the bottom or sent it.
 * - "indicate": a new message arrived while the student reads older ones → show the "new messages" pill.
 * - "none": the last message did not change (a no-op poll, an edit further up).
 */
export type AutoScrollDecision = "jump" | "smooth" | "indicate" | "none";

export interface AutoScrollInput {
  /** Id of the last message on screen before this update (null: nothing yet). */
  previousLastId: string | null;
  /** Id of the last message after this update (null: empty room). */
  nextLastId: string | null;
  /** The new last message is our own (optimistic or confirmed). */
  nextLastIsOwn: boolean;
  /** The list was near the bottom before this update. */
  nearBottom: boolean;
  /** The first "jump" already happened. */
  hasInitialScroll: boolean;
}

export function decideAutoScroll({
  previousLastId,
  nextLastId,
  nextLastIsOwn,
  nearBottom,
  hasInitialScroll,
}: AutoScrollInput): AutoScrollDecision {
  if (!nextLastId) return "none";
  if (!hasInitialScroll) return "jump";
  if (previousLastId === nextLastId) return "none";
  if (nextLastIsOwn || nearBottom) return "smooth";
  return "indicate";
}

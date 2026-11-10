/**
 * Movement direction for the stick and keyboard games.
 *
 * VirtualDPad sends `stickVector`, which is always length 1 (or 0 when the
 * thumb rests in the middle). The keyboard sends (1, 1) on a diagonal. Game
 * code calls `clampMoveVector` once on whatever it gets, so every direction
 * moves at the same speed.
 */

export type MoveVector = { dx: number; dy: number };

const STICK_DEADZONE_PX = 5;
/** About 8 degrees either side of an axis: thumbs wobble, and a straight walk should stay straight. */
const AXIS_ASSIST = Math.sin((8 * Math.PI) / 180);

/** Shrinks a vector longer than 1 to length 1. Shorter vectors keep their length. */
export function clampMoveVector(dx: number, dy: number): MoveVector {
  const length = Math.hypot(dx, dy);
  if (length <= 1) return { dx, dy };
  return { dx: dx / length, dy: dy / length };
}

/** Turns the thumb's offset from the stick's centre (in pixels) into a walking direction. */
export function stickVector(offsetX: number, offsetY: number): MoveVector {
  const distance = Math.hypot(offsetX, offsetY);
  if (distance < STICK_DEADZONE_PX) return { dx: 0, dy: 0 };
  const dx = offsetX / distance;
  const dy = offsetY / distance;
  if (Math.abs(dx) < AXIS_ASSIST) return { dx: 0, dy: Math.sign(dy) };
  if (Math.abs(dy) < AXIS_ASSIST) return { dx: Math.sign(dx), dy: 0 };
  return { dx, dy };
}

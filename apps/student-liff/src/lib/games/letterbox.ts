// Fit a fixed-size game board (e.g. 390x700 portrait) into its container:
// uniform "contain" scale, centred, so phones look as designed and wide frames
// letterbox around the board instead of drawing it in the top-left corner.
// Shared by apps/student-liff and apps/tutor-pwa (keep identical).

export type Letterbox = { scale: number; x: number; y: number }

export function computeLetterbox(
  view: { width: number; height: number },
  board: { width: number; height: number },
): Letterbox {
  if (!(view.width > 0 && view.height > 0 && board.width > 0 && board.height > 0)) {
    return { scale: 1, x: 0, y: 0 }
  }
  const scale = Math.min(view.width / board.width, view.height / board.height)
  return {
    scale,
    x: (view.width - board.width * scale) / 2,
    y: (view.height - board.height * scale) / 2,
  }
}

/** Convert a point in container pixels to board coordinates. */
export function toBoardPoint(box: Letterbox, point: { x: number; y: number }) {
  return { x: (point.x - box.x) / box.scale, y: (point.y - box.y) / box.scale }
}

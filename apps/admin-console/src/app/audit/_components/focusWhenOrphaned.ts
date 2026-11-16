/**
 * After an action removes or disables the control that started it (a row's
 * "ลบ" button, "ล้างข้อมูล" once nothing is selected), the dialog that closes
 * cannot hand focus back to it and focus falls to <body> or <main>. This puts
 * it on `getTarget()` instead, once the dialog's exit animation is over.
 */
export function focusWhenOrphaned(getTarget: () => HTMLElement | null | undefined, delay = 400) {
  window.setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    const lost =
      !active ||
      active === document.body ||
      active.id === "main-content" ||
      !active.isConnected ||
      (active instanceof HTMLButtonElement && active.disabled);
    if (lost) getTarget()?.focus();
  }, delay);
}

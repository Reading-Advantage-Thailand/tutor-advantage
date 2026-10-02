"use client";

import { useCallback, useSyncExternalStore } from "react";
// Relative import: unit-tested, and the root vitest config maps "@" to another app.
import { isNotificationSoundMuted, NOTIFICATION_MUTE_KEY, setNotificationSoundMuted } from "../../../lib/sounds";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab / the Notifications screen changed the same localStorage key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === NOTIFICATION_MUTE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => !isNotificationSoundMuted();
// Server render / hydration: sound on (the default) until the client reads storage.
const getServerSnapshot = () => true;

/**
 * The "เสียงแจ้งเตือน" setting, backed by the same localStorage key that
 * playNotificationSound() and the Notifications screen use.
 */
export function useNotificationSound(): [enabled: boolean, setEnabled: (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setEnabled = useCallback((next: boolean) => {
    setNotificationSoundMuted(!next);
    listeners.forEach((listener) => listener());
  }, []);
  return [enabled, setEnabled];
}

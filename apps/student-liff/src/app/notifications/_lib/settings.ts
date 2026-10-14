/**
 * Notification settings: response parsing (same defaults/merge as before) and
 * an auto-saver that persists each toggle right away.
 * No "@/…" imports: the root vitest config maps "@" to another app.
 */

export interface NotificationSettings {
  notifyClassReminders: boolean;
  notifyScoreUpdates: boolean;
  notifyLineMessages: boolean;
  notifyMarketing: boolean;
  /** Extra keys the server sends are kept and sent back unchanged. */
  [key: string]: unknown;
}

export type NotificationToggleKey =
  | "notifyClassReminders"
  | "notifyScoreUpdates"
  | "notifyLineMessages"
  | "notifyMarketing";

/** GET /users/me/settings response (the parts this screen reads). */
export interface SettingsResponse {
  settings?: { notifications?: Partial<NotificationSettings> | null; [key: string]: unknown } | null;
  lineConnected?: boolean;
  [key: string]: unknown;
}

/** Defaults shown before/without server values (unchanged). */
export const DEFAULT_NOTIFICATION_SETTINGS: Readonly<NotificationSettings> = {
  notifyClassReminders: true,
  notifyScoreUpdates: true,
  notifyLineMessages: true,
  notifyMarketing: false,
};

/** Server values merged over the defaults (same merge as the old screen). */
export function resolveNotificationSettings(response: SettingsResponse | null | undefined): NotificationSettings {
  if (!response || !response.settings) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(response.settings.notifications || {}) };
}

/** `lineConnected` was only read when the response had `settings` (unchanged). */
export function isLineConnected(response: SettingsResponse | null | undefined): boolean {
  return Boolean(response && response.settings && response.lineConnected === true);
}

/** The cached response with new notification settings (for optimistic updates). */
export function withNotificationSettings(
  response: SettingsResponse | null | undefined,
  notifications: NotificationSettings,
): SettingsResponse {
  return { ...(response ?? {}), settings: { ...(response?.settings ?? {}), notifications } };
}

export interface AutoSaverOptions<T extends object> {
  /** PATCH the whole object (the old Save button also sent the whole object). */
  save: (value: T) => Promise<unknown>;
  /** The value on screen changed (optimistic toggle, or revert after an error). */
  onChange: (value: T) => void;
  onSaved?: (value: T) => void;
  onError?: (error: unknown) => void;
}

export interface AutoSaver<T extends object> {
  /** Set one key, show it at once, and queue a save. `base` is the value on screen when idle. */
  set: <K extends keyof T>(base: T, key: K, value: T[K]) => Promise<void>;
  /** True while saves are queued or running. */
  isSaving: () => boolean;
}

/**
 * Saves one toggle at a time, in order. Each save sends the LATEST full value,
 * so the last write always matches the screen. When a save fails, only the
 * key of that toggle goes back to its old value (unless it was changed again).
 */
export function createAutoSaver<T extends object>({ save, onChange, onSaved, onError }: AutoSaverOptions<T>): AutoSaver<T> {
  let desired: T | null = null;
  let lastSaved: T | null = null;
  let pending = 0;
  let chain: Promise<void> = Promise.resolve();

  return {
    set(base, key, value) {
      const current = desired ?? base;
      const previousValue = current[key];
      if (Object.is(previousValue, value)) return chain;
      desired = { ...current, [key]: value };
      onChange(desired);
      pending += 1;
      chain = chain.then(async () => {
        const payload = desired as T;
        if (payload !== lastSaved) {
          try {
            await save(payload);
            lastSaved = payload;
            onSaved?.(payload);
          } catch (error) {
            if (desired && Object.is(desired[key], value)) {
              desired = { ...desired, [key]: previousValue };
              onChange(desired);
            }
            onError?.(error);
          }
        }
        pending -= 1;
        if (pending === 0) {
          desired = null;
          lastSaved = null;
        }
      });
      return chain;
    },
    isSaving: () => pending > 0,
  };
}

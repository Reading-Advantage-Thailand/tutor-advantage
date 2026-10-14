import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  createAutoSaver,
  isLineConnected,
  resolveNotificationSettings,
  withNotificationSettings,
  type NotificationSettings,
} from "./settings";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("settings response", () => {
  it("merges server values over the defaults and keeps unknown keys", () => {
    expect(
      resolveNotificationSettings({ settings: { notifications: { notifyMarketing: true, digest: "weekly" } } }),
    ).toEqual({ ...DEFAULT_NOTIFICATION_SETTINGS, notifyMarketing: true, digest: "weekly" });
  });

  it("falls back to the defaults without settings", () => {
    expect(resolveNotificationSettings(undefined)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(resolveNotificationSettings({ lineConnected: true })).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(resolveNotificationSettings({ settings: { notifications: null } })).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it("reads lineConnected only when settings exist (as before)", () => {
    expect(isLineConnected({ settings: {}, lineConnected: true })).toBe(true);
    expect(isLineConnected({ lineConnected: true })).toBe(false);
    expect(isLineConnected({ settings: {}, lineConnected: false })).toBe(false);
  });

  it("writes new notifications into a copy of the response", () => {
    const response = { settings: { notifications: { notifyMarketing: false }, theme: "dark" }, lineConnected: true };
    const next = withNotificationSettings(response, { ...DEFAULT_NOTIFICATION_SETTINGS, notifyMarketing: true });
    expect(next.settings?.notifications?.notifyMarketing).toBe(true);
    expect(next.settings?.theme).toBe("dark");
    expect(next.lineConnected).toBe(true);
    expect(response.settings.notifications.notifyMarketing).toBe(false);
  });
});

describe("createAutoSaver", () => {
  const base: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };

  it("shows the toggle at once and PATCHes the whole object", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    const onSaved = vi.fn();
    const saver = createAutoSaver<NotificationSettings>({ save, onChange, onSaved });

    const done = saver.set(base, "notifyMarketing", true);
    expect(onChange).toHaveBeenCalledWith({ ...base, notifyMarketing: true });
    expect(saver.isSaving()).toBe(true);
    await done;
    expect(save).toHaveBeenCalledWith({ ...base, notifyMarketing: true });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(saver.isSaving()).toBe(false);
  });

  it("saves one at a time and always sends the latest value", async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const saver = createAutoSaver<NotificationSettings>({ save, onChange: vi.fn() });

    saver.set(base, "notifyMarketing", true);
    const done = saver.set(base, "notifyScoreUpdates", false);
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ notifyMarketing: true, notifyScoreUpdates: false });

    first.resolve();
    await done;
    // The second step has nothing new to send (the first already sent the latest value).
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reverts only the failed toggle and reports the error", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValue(undefined);
    const onChange = vi.fn();
    const onError = vi.fn();
    const saver = createAutoSaver<NotificationSettings>({ save, onChange, onError });

    const done = saver.set(base, "notifyMarketing", true);
    await done;
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...base, notifyMarketing: false });
  });

  it("re-sends the corrected value after a failed step so the server matches the screen", async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const onChange = vi.fn();
    const saver = createAutoSaver<NotificationSettings>({ save, onChange, onError: vi.fn() });

    saver.set(base, "notifyMarketing", true);
    const done = saver.set(base, "notifyScoreUpdates", false);
    first.reject(new Error("offline"));
    await done;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ notifyMarketing: false, notifyScoreUpdates: false });
    expect(onChange).toHaveBeenLastCalledWith({ ...base, notifyMarketing: false, notifyScoreUpdates: false });
  });

  it("ignores a toggle to the value already shown", async () => {
    const save = vi.fn();
    const saver = createAutoSaver<NotificationSettings>({ save, onChange: vi.fn() });
    await saver.set(base, "notifyClassReminders", true);
    expect(save).not.toHaveBeenCalled();
  });
});

import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logger } from "@tutor-advantage/shared-config";

const USER_SETTING_KEYS = new Set([
  "lineNotification",
  "locale",
  "theme",
  "soundEnabled",
  "soundEffects",
]);
const NOTIFICATION_SETTING_KEYS = new Set([
  "notifyClassReminders",
  "notifyScoreUpdates",
  "notifyLineMessages",
  "notifyMarketing",
]);

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const [ObjectUser, lineIdentity] = await Promise.all([
      prisma.user.findUnique({
        where: { userId },
        select: { settings: true },
      }),
      prisma.oAuthIdentity.findFirst({
        where: {
          userId,
          provider: "line",
        },
        select: { identityId: true },
      }),
    ]);

    if (!ObjectUser) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Prisma returns JsonValue, we ensure it's an object or provide a default empty object
    const settings = ObjectUser.settings || {};

    return res.status(200).json({
      settings,
      lineConnected: Boolean(lineIdentity),
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Get Settings Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch user settings",
        requestId: req.id,
      },
    });
  }
}

export async function updateSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const newSettings = req.body;
    if (!isSettingsObject(newSettings)) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Settings payload must be an object" },
      });
    }

    const unsupportedKeys = Object.keys(newSettings).filter(
      (key) => key !== "notifications" && !USER_SETTING_KEYS.has(key),
    );
    if (unsupportedKeys.length > 0) {
      return res.status(400).json({
        error: {
          code: "PROTECTED_SETTING",
          message: "Only user preference settings can be updated",
          fields: unsupportedKeys,
        },
      });
    }

    const newNotifications = newSettings.notifications;
    if (newNotifications !== undefined) {
      if (!isSettingsObject(newNotifications)) {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "notifications must be an object",
          },
        });
      }

      const unsupportedNotificationKeys = Object.keys(newNotifications).filter(
        (key) => !NOTIFICATION_SETTING_KEYS.has(key),
      );
      if (unsupportedNotificationKeys.length > 0) {
        return res.status(400).json({
          error: {
            code: "PROTECTED_SETTING",
            message: "Unsupported notification setting",
            fields: unsupportedNotificationKeys,
          },
        });
      }

      const invalidNotificationValues = Object.entries(newNotifications)
        .filter(([, value]) => typeof value !== "boolean")
        .map(([key]) => key);
      if (invalidNotificationValues.length > 0) {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "Notification settings must be boolean",
            fields: invalidNotificationValues,
          },
        });
      }
    }

    // Find current user to get existing settings
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { settings: true },
    });

    if (!currentUser) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    const currentSettings = isSettingsObject(currentUser.settings)
      ? currentUser.settings
      : {};
    
    // Merge notification preferences independently so a partial update does not
    // erase preferences written by another screen or an older client.
    const currentNotifications =
      currentSettings.notifications &&
      typeof currentSettings.notifications === "object" &&
      !Array.isArray(currentSettings.notifications)
        ? currentSettings.notifications as Record<string, unknown>
        : {};
    const notificationUpdates = newNotifications as Record<string, unknown> | undefined;
    const mergedSettings = {
      ...currentSettings,
      ...Object.fromEntries(
        Object.entries(newSettings).filter(([key]) => key !== "notifications"),
      ),
      ...(notificationUpdates
        ? { notifications: { ...currentNotifications, ...notificationUpdates } }
        : {}),
    };

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { settings: mergedSettings as Record<string, any> },
      select: { settings: true },
    });

    return res.status(200).json({ settings: updatedUser.settings });
  } catch (error) {
    const err = error as Error;
    logger.error("Update Settings Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not update user settings",
        requestId: req.id,
      },
    });
  }
}

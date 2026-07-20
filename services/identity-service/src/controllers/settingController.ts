import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logger } from "@tutor-advantage/shared-config";

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
    if (typeof newSettings !== "object" || Array.isArray(newSettings) || newSettings === null) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Settings payload must be an object" },
      });
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

    const currentSettings = (currentUser.settings as Record<string, any>) || {};
    
    // Merge notification preferences independently so a partial update does not
    // erase preferences written by another screen or an older client.
    const currentNotifications =
      currentSettings.notifications &&
      typeof currentSettings.notifications === "object" &&
      !Array.isArray(currentSettings.notifications)
        ? currentSettings.notifications as Record<string, unknown>
        : {};
    const newNotifications =
      newSettings.notifications &&
      typeof newSettings.notifications === "object" &&
      !Array.isArray(newSettings.notifications)
        ? newSettings.notifications as Record<string, unknown>
        : null;
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
      ...(newNotifications
        ? { notifications: { ...currentNotifications, ...newNotifications } }
        : {}),
    };

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { settings: mergedSettings },
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

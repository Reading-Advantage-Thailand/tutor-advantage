import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const ObjectUser = await prisma.user.findUnique({
      where: { userId },
      select: { settings: true },
    });

    if (!ObjectUser) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Prisma returns JsonValue, we ensure it's an object or provide a default empty object
    const settings = ObjectUser.settings || {};

    return res.status(200).json({ settings });
  } catch (error: any) {
    console.error("Get Settings Error:", error);
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
    
    // Merge current settings with new settings
    const mergedSettings = { ...currentSettings, ...newSettings };

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { settings: mergedSettings },
      select: { settings: true },
    });

    return res.status(200).json({ settings: updatedUser.settings });
  } catch (error: any) {
    console.error("Update Settings Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not update user settings",
        requestId: req.id,
      },
    });
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
const database_1 = require("@tutor-advantage/database");
const shared_config_1 = require("@tutor-advantage/shared-config");
async function getSettings(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const ObjectUser = await database_1.prisma.user.findUnique({
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
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("Get Settings Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch user settings",
                requestId: req.id,
            },
        });
    }
}
async function updateSettings(req, res) {
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
        const currentUser = await database_1.prisma.user.findUnique({
            where: { userId },
            select: { settings: true },
        });
        if (!currentUser) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "User not found" },
            });
        }
        const currentSettings = currentUser.settings || {};
        // Merge current settings with new settings
        const mergedSettings = { ...currentSettings, ...newSettings };
        const updatedUser = await database_1.prisma.user.update({
            where: { userId },
            data: { settings: mergedSettings },
            select: { settings: true },
        });
        return res.status(200).json({ settings: updatedUser.settings });
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("Update Settings Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not update user settings",
                requestId: req.id,
            },
        });
    }
}

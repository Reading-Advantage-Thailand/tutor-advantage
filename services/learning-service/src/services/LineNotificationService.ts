import { logger } from "@tutor-advantage/shared-config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface NotificationOptions {
  type: "notifyClassReminders" | "notifyScoreUpdates" | "notifyLineMessages" | "notifyMarketing";
}

export class LineNotificationService {
  /**
   * Builds a LIFF deep-link URL to a specific path inside the Student LIFF portal.
   * e.g. buildLiffDeepLink("/chat/abc123") → "https://liff.line.me/xxxx?redirect=%2Fchat%2Fabc123"
   */
  static buildLiffDeepLink(path: string): string {
    const LIFF_URL = process.env.LIFF_URL ?? "";
    if (!LIFF_URL) return "";
    return `${LIFF_URL}?redirect=${encodeURIComponent(path)}`;
  }

  /**
   * Sends a push message to a user via LINE Messaging API if they have the preference enabled.
   */
  static async sendToUser(
    userId: string, 
    message: string, 
    options?: NotificationOptions
  ): Promise<boolean> {
    try {
      const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!LINE_CHANNEL_ACCESS_TOKEN) {
        logger.warn("[LineNotificationService] LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping.");
        return false;
      }

      // 1. Fetch user settings to check notification preference
      const user = await prisma.user.findUnique({
        where: { userId },
        select: { settings: true }
      });

      if (!user) {
        logger.warn(`[LineNotificationService] User ${userId} not found.`);
        return false;
      }

      // Check user settings preference
      if (options && options.type) {
        const settings = (user.settings as Record<string, any>)?.notifications || {};
        // Default to true for essential notifications if undefined, but false for marketing
        const defaultValue = options.type === "notifyMarketing" ? false : true;
        const isEnabled = settings[options.type] !== undefined ? settings[options.type] : defaultValue;

        if (!isEnabled) {
          logger.info(`[LineNotificationService] User ${userId} has disabled ${options.type}. Notification suppressed.`);
          return false;
        }
      }

      // 2. Find the user's LINE Subject ID
      const lineIdentity = await prisma.oAuthIdentity.findFirst({
        where: {
          userId,
          provider: "line"
        }
      });

      if (!lineIdentity || !lineIdentity.providerSubject) {
        logger.info(`[LineNotificationService] No linked LINE identity found for user ${userId}. Cannot push.`);
        return false;
      }

      const lineUserId = lineIdentity.providerSubject;

      // 3. Prepare the message payload for LINE API
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[LineNotificationService] LINE API error: ${response.status}`, errorText);
        return false;
      }

      logger.info(`[LineNotificationService] Notification sent successfully to user ${userId} (LINE: ${lineUserId})`);
      return true;

    } catch (error) {
      logger.error(`[LineNotificationService] Critical error sending notification to ${userId}:`, error);
      return false;
    }
  }
}

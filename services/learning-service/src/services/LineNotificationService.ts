import { logger } from "@tutor-advantage/shared-config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface NotificationOptions {
  type: "notifyClassReminders" | "notifyScoreUpdates" | "notifyLineMessages" | "notifyMarketing";
}

type LineMessage = Record<string, unknown>;
export type LineNotificationResult = {
  sent: boolean;
  reason?: "LINE_NOT_CONFIGURED" | "USER_NOT_FOUND" | "PREFERENCE_DISABLED" | "LINE_NOT_LINKED" | "LINE_API_ERROR" | "UNEXPECTED_ERROR";
  lineStatus?: number;
};

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
    return (await this.sendMessagesToUser(userId, [{ type: "text", text: message }], options)).sent;
  }

  static async sendFlexToUser(
    userId: string,
    altText: string,
    contents: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<boolean> {
    return (await this.sendFlexToUserWithResult(userId, altText, contents, options)).sent;
  }

  static async sendFlexToUserWithResult(
    userId: string,
    altText: string,
    contents: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<LineNotificationResult> {
    return this.sendMessagesToUser(userId, [{ type: "flex", altText, contents }], options);
  }

  private static async sendMessagesToUser(
    userId: string,
    messages: LineMessage[],
    options?: NotificationOptions,
  ): Promise<LineNotificationResult> {
    try {
      const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!LINE_CHANNEL_ACCESS_TOKEN) {
        logger.warn("[LineNotificationService] LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping.");
        return { sent: false, reason: "LINE_NOT_CONFIGURED" };
      }

      // 1. Fetch user settings to check notification preference
      const user = await prisma.user.findUnique({
        where: { userId },
        select: { settings: true }
      });

      if (!user) {
        logger.warn(`[LineNotificationService] User ${userId} not found.`);
        return { sent: false, reason: "USER_NOT_FOUND" };
      }

      // Check user settings preference
      if (options && options.type) {
        const settings = (user.settings as Record<string, any>)?.notifications || {};
        // Default to true for essential notifications if undefined, but false for marketing
        const defaultValue = options.type === "notifyMarketing" ? false : true;
        const isEnabled = settings[options.type] !== undefined ? settings[options.type] : defaultValue;

        if (!isEnabled) {
          logger.info(`[LineNotificationService] User ${userId} has disabled ${options.type}. Notification suppressed.`);
          return { sent: false, reason: "PREFERENCE_DISABLED" };
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
        return { sent: false, reason: "LINE_NOT_LINKED" };
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
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[LineNotificationService] LINE API error: ${response.status}`, errorText);
        return { sent: false, reason: "LINE_API_ERROR", lineStatus: response.status };
      }

      logger.info(`[LineNotificationService] Notification sent successfully to user ${userId} (LINE: ${lineUserId})`);
      return { sent: true };

    } catch (error) {
      logger.error(`[LineNotificationService] Critical error sending notification to ${userId}:`, error);
      return { sent: false, reason: "UNEXPECTED_ERROR" };
    }
  }
}

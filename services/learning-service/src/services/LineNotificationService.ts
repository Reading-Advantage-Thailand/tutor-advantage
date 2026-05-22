import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export interface NotificationOptions {
  type: "notifyClassReminders" | "notifyScoreUpdates" | "notifyLineMessages" | "notifyMarketing";
}

export class LineNotificationService {
  /**
   * Sends a push message to a user via LINE Messaging API if they have the preference enabled.
   */
  static async sendToUser(
    userId: string, 
    message: string, 
    options?: NotificationOptions
  ): Promise<boolean> {
    try {
      if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.warn("[LineNotificationService] LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping.");
        return false;
      }

      // 1. Fetch user settings to check notification preference
      const user = await prisma.user.findUnique({
        where: { userId },
        select: { settings: true }
      });

      if (!user) {
        console.warn(`[LineNotificationService] User ${userId} not found.`);
        return false;
      }

      // Check user settings preference
      if (options && options.type) {
        const settings = (user.settings as Record<string, any>)?.notifications || {};
        // Default to true for essential notifications if undefined, but false for marketing
        const defaultValue = options.type === "notifyMarketing" ? false : true;
        const isEnabled = settings[options.type] !== undefined ? settings[options.type] : defaultValue;

        if (!isEnabled) {
          console.log(`[LineNotificationService] User ${userId} has disabled ${options.type}. Notification suppressed.`);
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
        console.log(`[LineNotificationService] No linked LINE identity found for user ${userId}. Cannot push.`);
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
        console.error(`[LineNotificationService] LINE API error: ${response.status}`, errorText);
        return false;
      }

      console.log(`[LineNotificationService] Notification sent successfully to user ${userId} (LINE: ${lineUserId})`);
      return true;

    } catch (error) {
      console.error(`[LineNotificationService] Critical error sending notification to ${userId}:`, error);
      return false;
    }
  }
}

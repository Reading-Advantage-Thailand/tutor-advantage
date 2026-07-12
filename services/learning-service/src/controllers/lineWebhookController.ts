import crypto from "crypto";
import { logger } from "@tutor-advantage/shared-config";
import { Request, Response } from "express";
import { LineNotificationService } from "../services/LineNotificationService";

type LineWebhookRequest = Request & {
  rawBody?: Buffer;
};

interface LineTextMessageEvent {
  type: "message";
  replyToken: string;
  message: {
    type: "text";
    text: string;
  };
}

interface LineWebhookBody {
  events?: unknown[];
}

type LineMessage = Record<string, unknown> & {
  type: string;
};

function normalizeCommand(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "");
}

function isAccessCommand(text: string): boolean {
  const command = normalizeCommand(text);
  return [
    "เข้าใช้งาน",
    "เข้าใช้",
    "เปิดแอป",
    "เปิดapp",
    "เปิด Tutor Advantage",
    "login",
    "Tutor Advantage",
    "ไม่เห็น",
    "ไม่เห็นการ์ด",
    "มองไม่เห็น",
  ].includes(command);
}

function isLineTextMessageEvent(event: unknown): event is LineTextMessageEvent {
  if (!event || typeof event !== "object") {
    return false;
  }

  const candidate = event as LineTextMessageEvent;
  return (
    candidate.type === "message" &&
    typeof candidate.replyToken === "string" &&
    candidate.message?.type === "text" &&
    typeof candidate.message.text === "string"
  );
}

function getStudentPortalUrl(): string {
  const dashboardLink = LineNotificationService.buildLiffDeepLink("/dashboard");
  if (dashboardLink) {
    return dashboardLink;
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}/dashboard` : "";
}

function buildAccessMessages(portalUrl: string): LineMessage[] {
  const fallbackText = portalUrl
    ? `หากไม่เห็นการ์ด กดลิงก์นี้เพื่อเข้าใช้งาน Tutor Advantage:\n${portalUrl}`
    : "ขออภัย ระบบยังไม่ได้ตั้งค่า LIFF URL สำหรับเข้าใช้งาน กรุณาติดต่อทีมงาน";

  if (!portalUrl) {
    return [{ type: "text", text: fallbackText }];
  }

  return [
    {
      type: "flex",
      altText: "เข้าใช้งาน Tutor Advantage",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: "Tutor Advantage",
              weight: "bold",
              size: "xl",
            },
            {
              type: "text",
              text: "กดปุ่มเพื่อเข้าใช้งานระบบนักเรียน",
              size: "sm",
              color: "#555555",
              wrap: true,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#06C755",
              action: {
                type: "uri",
                label: "เข้าใช้งาน",
                uri: portalUrl,
              },
            },
          ],
        },
      },
    },
    {
      type: "text",
      text: fallbackText,
    },
  ];
}

function isValidLineSignature(req: LineWebhookRequest): boolean {
  const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
  if (!LINE_CHANNEL_SECRET || !req.rawBody) {
    return false;
  }

  const signature = req.header("x-line-signature");
  if (!signature) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest("base64");
  const expected = Buffer.from(digest);
  const actual = Buffer.from(signature);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function replyToLine(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    logger.warn("[LINE Webhook] LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping reply.");
    return false;
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    logger.error("[LINE Webhook] Reply API failed", {
      status: response.status,
      body: await response.text(),
    });
    return false;
  }

  return true;
}

export async function handleLineWebhook(req: LineWebhookRequest, res: Response): Promise<void> {
  if (!isValidLineSignature(req)) {
    res.status(401).send("Invalid LINE signature");
    return;
  }

  const body = req.body as LineWebhookBody;
  const events = body.events ?? [];

  try {
    await Promise.all(
      events.filter(isLineTextMessageEvent).map(async (event) => {
        if (!isAccessCommand(event.message.text)) {
          return;
        }

        await replyToLine(event.replyToken, buildAccessMessages(getStudentPortalUrl()));
      }),
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("[LINE Webhook] Failed to handle event", error);
    res.status(500).json({ error: "Failed to handle LINE webhook" });
  }
}

/**
 * Minimal Discord webhook client for operational alerts.
 *
 * Never throws and never logs through the winston logger at error level: the
 * Discord alert transport calls this from inside logger.error, so an error log
 * here would loop. Its own failures go to console.warn, and the webhook URL
 * (which is itself a credential) is never printed.
 */

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
  timestamp?: string;
  footer?: { text: string };
}

export interface PostDiscordEmbedsOptions {
  webhookUrl?: string;
  username?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface PostDiscordEmbedsResult {
  ok: boolean;
  status?: number;
  reason?: "NOT_CONFIGURED" | "HTTP_ERROR" | "NETWORK_ERROR";
}

// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
export const DISCORD_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  embeds: 10,
  total: 6000,
} as const;

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_USERNAME = "Tutor Advantage";

function truncate(value: string, max: number): string {
  if (max <= 0) return "";
  if (value.length <= max) return value;
  if (max === 1) return "…";
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Clamps embeds to Discord's per-field limits and the 6000-character budget
 * shared by every embed in one message. Embeds that no longer fit are dropped;
 * the first embed always keeps at least its (possibly shortened) title.
 */
export function truncateDiscordEmbeds(embeds: DiscordEmbed[]): DiscordEmbed[] {
  let budget: number = DISCORD_LIMITS.total;
  const result: DiscordEmbed[] = [];

  for (const embed of embeds.slice(0, DISCORD_LIMITS.embeds)) {
    if (budget <= 0) break;

    const title = truncate(embed.title || "-", Math.min(DISCORD_LIMITS.title, budget));
    budget -= title.length;
    const out: DiscordEmbed = { title };
    if (embed.color !== undefined) out.color = embed.color;
    if (embed.url) out.url = embed.url;
    if (embed.timestamp) out.timestamp = embed.timestamp;

    if (embed.description && budget > 0) {
      out.description = truncate(embed.description, Math.min(DISCORD_LIMITS.description, budget));
      budget -= out.description.length;
    }

    if (embed.fields?.length) {
      const fields: NonNullable<DiscordEmbed["fields"]> = [];
      for (const field of embed.fields.slice(0, DISCORD_LIMITS.fields)) {
        const name = truncate(field.name || "-", DISCORD_LIMITS.fieldName);
        // Discord rejects empty field values.
        const value = truncate(field.value || "-", DISCORD_LIMITS.fieldValue);
        if (name.length + value.length > budget) break;
        budget -= name.length + value.length;
        fields.push(field.inline === undefined ? { name, value } : { name, value, inline: field.inline });
      }
      if (fields.length) out.fields = fields;
    }

    if (embed.footer?.text && budget > 0) {
      const text = truncate(embed.footer.text, Math.min(DISCORD_LIMITS.footer, budget));
      budget -= text.length;
      out.footer = { text };
    }

    result.push(out);
  }

  return result;
}

/** Posts embeds to a Discord webhook. Resolves with the outcome; never rejects. */
export async function postDiscordEmbeds(
  embeds: DiscordEmbed[],
  opts: PostDiscordEmbedsOptions = {},
): Promise<PostDiscordEmbedsResult> {
  const webhookUrl = opts.webhookUrl ?? process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, reason: "NOT_CONFIGURED" };

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const body = JSON.stringify({
      username: opts.username ?? DEFAULT_USERNAME,
      embeds: truncateDiscordEmbeds(embeds),
      // Alert text comes from error messages; never let it ping anyone.
      allowed_mentions: { parse: [] },
    });
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[discord] webhook responded with HTTP ${response.status}`);
      return { ok: false, status: response.status, reason: "HTTP_ERROR" };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.warn(`[discord] webhook request failed (${name})`);
    return { ok: false, reason: "NETWORK_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}

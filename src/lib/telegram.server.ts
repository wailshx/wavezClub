// Server-only Telegram Bot API helper.
//
// Used for the owner's own "new admin request" alert. Applicant-facing mail
// still goes out over Resend; this is deliberately scoped to the one
// notification the club owner has to see immediately.
//
// The bot token is a credential: anyone holding it can send messages as this
// bot and read its updates. It is read from the environment and is never
// written to a log line.

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * Telegram's `parse_mode: "HTML"` only understands a small set of tags, and it
 * rejects the whole message on a bare `<`. The fields interpolated below are
 * applicant-supplied, so a name like "Ali <b>" would otherwise turn every
 * owner alert into a 400.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A token is never logged; this is enough to tell "no token" from "wrong token". */
function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Send one HTML message to the configured chat.
 *
 * Never throws, matching sendResendEmail: a failed notification must not block
 * the surrounding work. The caller gets the result and decides whether to
 * surface the failure.
 */
export async function sendTelegramMessage(
  text: string,
  opts: { chatId?: string } = {},
): Promise<TelegramResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = opts.chatId ?? process.env["TELEGRAM_CHAT_ID"];

  if (!isConfigured(token) || !isConfigured(chatId)) {
    const missing = [
      ...(isConfigured(token) ? [] : ["TELEGRAM_BOT_TOKEN"]),
      ...(isConfigured(chatId) ? [] : ["TELEGRAM_CHAT_ID"]),
    ];
    console.error(
      `[telegram] ${missing.join(", ")} not set on the server — message NOT sent. ` +
        `Preview: ${text.slice(0, 200)}`,
    );
    return { ok: false, error: `${missing.join(" and ")} is not configured on the server.` };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;

    if (!res.ok || json?.ok === false) {
      const detail = json?.description ?? `HTTP ${res.status}`;
      console.error(`[telegram] send FAILED. chat=${chatId} error=${detail}`);
      return { ok: false, error: detail };
    }

    const id = json?.result?.message_id ?? 0;
    console.log(`[telegram] sent id=${id} chat=${chatId}`);
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[telegram] send threw. chat=${chatId} error=${msg}`);
    return { ok: false, error: msg };
  }
}

export { escapeHtml };

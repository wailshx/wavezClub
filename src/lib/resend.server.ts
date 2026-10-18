// Server-only Resend email helper.
// Import this ONLY via `await import()` from within server function handlers —
// never at module scope in client-compiled modules.
//
// Sender address rules (Resend):
//   - Resend has NO "sender identity" concept. You verify a DNS DOMAIN, then
//     you can send from ANY address at that domain (even one that doesn't
//     exist elsewhere). No verification email is ever sent to an address like
//     `wavezclub22@gmail.com` for that purpose.
//   - Resend CANNOT send from consumer mailboxes (gmail.com, yahoo.com, …):
//     `from` must be at a domain verified in the Resend dashboard
//     (https://resend.com/domains). Until a domain is verified, only the
//     temporary `onboarding@resend.dev` sender works, and ONLY the account
//     owner's own address can be a recipient (test mode).
//
// Address split:
//   - `OWNER_EMAIL` (wailkr68@gmail.com): recipient of private owner alerts.
//   - `CLUB_EMAIL`  (wavezclub22@gmail.com): the club's official public-facing
//     mailbox. Resend cannot USE it as the From address (gmail.com unverifiable),
//     so it is wired as `replyTo` (replies land in that human inbox) and used as
//     the From address automatically once it points at a verified-domain address
//     (e.g. no-reply@wavez.club).

export type ResendResult = { ok: true; id: string } | { ok: false; error: string };

const RESEND_API_URL = "https://api.resend.com/emails";

const CONSUMER_MAIL_DOMAINS =
  /@(gmail|googlemail)\.(com|com\.\w+)$|@(yahoo|hotmail|outlook|live|icloud|proton|aol)\./i;

/** CLUB_EMAIL from env, or null when unset. */
export function getClubEmail(): string | null {
  const raw = (process.env["CLUB_EMAIL"] ?? "").trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Resolve the From address for club-originated mail (rejections, bulk member
 * email). Consumes CLUB_EMAIL when it is usable as a Resend sender (i.e. NOT a
 * consumer mailbox — must be at a domain the club can verify). Otherwise falls
 * back to the temporary onboarding sender so sending keeps working, and logs a
 * loud reminder that a domain is needed for the club sender to be real.
 */
function resolveClubSender(): { from: string; replyTo: string | undefined } {
  const club = getClubEmail();
  const genericFrom = process.env["RESEND_FROM"] ?? "onboarding@resend.dev";
  // A verified-domain sender is usually a no-reply address, and replies to one
  // bounce. `CLUB_REPLY_TO` lets the sender stay on the domain while replies
  // land in a mailbox someone actually reads; it defaults to CLUB_EMAIL.
  const replyTo = (process.env["CLUB_REPLY_TO"] ?? club ?? "").trim() || undefined;
  if (!club) return { from: genericFrom, replyTo };
  if (!CONSUMER_MAIL_DOMAINS.test(club)) {
    return { from: `Wavez Club <${club}>`, replyTo };
  }
  console.warn(
    `[resend] CLUB_EMAIL="${club}" is a consumer mailbox Resend cannot send from ` +
      `(verified-domain addresses only). Using replyTo="${replyTo}" and From="${genericFrom}". ` +
      `Point CLUB_EMAIL at a verified-domain address (e.g. no-reply@wavez.club) to send as the club.`,
  );
  return { from: genericFrom, replyTo };
}

type SendOptions = {
  to: string | string[];
  subject: string;
  /** Plain-text body. Optional when `html` is provided (Resend takes either). */
  text?: string;
  /** Rendered HTML body, for the admin template emails. */
  html?: string;
  from?: string;
  replyTo?: string;
};

/**
 * Send a plain-text email via Resend's REST API.
 *
 * Never throws: failures (missing key, HTTP error, rate limit, network issue)
 * are logged loudly server-side and returned so callers can decide whether the
 * surrounding transaction should still succeed (it should — a failed email must
 * not block the admin_requests insert/update).
 */
export async function sendResendEmail(opts: SendOptions): Promise<ResendResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = opts.from ?? process.env["RESEND_FROM"] ?? "onboarding@resend.dev";
  const recipients = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;

  if (!apiKey) {
    console.error(
      `[resend] RESEND_API_KEY is not set — email NOT sent. from=${from} to=${recipients} subject="${opts.subject}"`,
    );
    return { ok: false, error: "RESEND_API_KEY is not configured on the server." };
  }

  if (!opts.text && !opts.html) {
    console.error(
      `[resend] send skipped — neither text nor html body provided. to=${recipients} subject="${opts.subject}"`,
    );
    return { ok: false, error: "The email has no body." };
  }

  try {
    const payload: Record<string, unknown> = {
      from,
      to: opts.to,
      subject: opts.subject,
    };
    if (opts.text) payload["text"] = opts.text;
    if (opts.html) payload["html"] = opts.html;
    if (opts.replyTo) payload["reply_to"] = opts.replyTo;

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      const detail = json?.message ?? JSON.stringify(json);
      console.error(
        `[resend] send FAILED (status ${res.status}). from=${from} to=${recipients} subject="${opts.subject}" error=${detail}`,
      );
      return { ok: false, error: detail };
    }

    console.log(
      `[resend] sent id=${json?.id ?? "?"} from=${from} replyTo=${opts.replyTo ?? "—"} to=${recipients} subject="${opts.subject}"`,
    );
    return { ok: true, id: json?.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[resend] send threw. to=${recipients} subject="${opts.subject}" error=${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * Club-originated mail: resolves the club sender (CLUB_EMAIL when usable) and
 * routes replies to the club mailbox. See resolveClubSender() for the fallback.
 */
export async function sendClubEmail(opts: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}): Promise<ResendResult> {
  const { from, replyTo } = resolveClubSender();
  return sendResendEmail(replyTo === undefined ? { ...opts, from } : { ...opts, from, replyTo });
}

/**
 * The sender identity the next club email will use, for the Emails console
 * page to show above the composer. `configured` is false when the server is
 * missing `RESEND_API_KEY` — sending would be a no-op, and the page warns
 * instead of offering a button that quietly does nothing.
 */
export function describeClubSender(): {
  from: string;
  replyTo: string | null;
  configured: boolean;
} {
  const { from, replyTo } = resolveClubSender();
  return { from, replyTo: replyTo ?? null, configured: Boolean(process.env["RESEND_API_KEY"]) };
}

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

/** Resend's batch endpoint takes at most 100 emails per request. */
export const RESEND_BATCH_LIMIT = 100;

type ClubBatchEmail = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

type ResendBatchResult = { ok: true; ids: string[] } | { ok: false; error: string };

/**
 * Send a batch of club emails in one HTTP request (Resend's batch endpoint).
 *
 * The Emails page uses this instead of a paced per-recipient loop: 75 students
 * are one request rather than ~40 seconds of sequential sends that a
 * serverless timeout could cut in half. Each email is still built for its own
 * recipient — personalization happens before this point.
 *
 * A failed request fails the whole batch (Resend validates every item before
 * sending any), and the caller reports those addresses back for a retry.
 */
export async function sendClubEmailBatch(emails: ClubBatchEmail[]): Promise<ResendBatchResult> {
  if (emails.length === 0) return { ok: true, ids: [] };
  if (emails.length > RESEND_BATCH_LIMIT) {
    return { ok: false, error: `Resend batches take at most ${RESEND_BATCH_LIMIT} emails.` };
  }

  const apiKey = process.env["RESEND_API_KEY"];
  const { from, replyTo } = resolveClubSender();
  const recipients = emails.map((email) => email.to).join(", ");

  if (!apiKey) {
    console.error(
      `[resend] RESEND_API_KEY is not set — batch NOT sent. from=${from} to=${recipients}`,
    );
    return { ok: false, error: "RESEND_API_KEY is not configured on the server." };
  }

  try {
    const payload = emails.map((email) => ({
      from,
      to: email.to,
      subject: email.subject,
      ...(email.text ? { text: email.text } : {}),
      ...(email.html ? { html: email.html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }));

    const res = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => null)) as {
      data?: { id?: string }[];
      message?: string;
    } | null;

    if (!res.ok) {
      const detail = json?.message ?? JSON.stringify(json);
      console.error(
        `[resend] batch FAILED (status ${res.status}, ${emails.length} emails). from=${from} to=${recipients} error=${detail}`,
      );
      return { ok: false, error: detail };
    }

    const ids = (json?.data ?? []).map((item) => item?.id ?? "");
    console.log(
      `[resend] batch sent ${ids.length}/${emails.length} emails from=${from} replyTo=${replyTo ?? "—"}`,
    );
    return { ok: true, ids };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[resend] batch threw. to=${recipients} error=${msg}`);
    return { ok: false, error: msg };
  }
}

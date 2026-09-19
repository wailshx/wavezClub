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
  if (!club) return { from: genericFrom, replyTo: undefined };
  if (!CONSUMER_MAIL_DOMAINS.test(club)) {
    return { from: `Wavez Club <${club}>`, replyTo: club };
  }
  console.warn(
    `[resend] CLUB_EMAIL="${club}" is a consumer mailbox Resend cannot send from ` +
      `(verified-domain addresses only). Using replyTo="${club}" and From="${genericFrom}". ` +
      `Point CLUB_EMAIL at a verified-domain address (e.g. no-reply@wavez.club) to send as the club.`,
  );
  return { from: genericFrom, replyTo: club };
}

type SendOptions = {
  to: string | string[];
  subject: string;
  text: string;
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

  try {
    const payload: Record<string, unknown> = {
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    };
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
  text: string;
}): Promise<ResendResult> {
  const { from, replyTo } = resolveClubSender();
  return sendResendEmail(replyTo === undefined ? { ...opts, from } : { ...opts, from, replyTo });
}

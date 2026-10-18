import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireAnySection, requireSection, SUBMISSION_SECTIONS } from "@/lib/admin-admins-api";
import {
  renderEmailTemplate,
  splitContactName,
  type EmailTemplateContact,
} from "@/lib/email-template";

/**
 * The Emails page: pick who a template goes to, watch the preview, send.
 *
 * Recipients are always resolved here, from the same tables the Members and
 * Submissions pages read — never sent up from the browser. That keeps the
 * count the officer confirms and the addresses that are actually mailed from
 * being able to disagree, and it keeps the permission check next to the data
 * it protects: the Members source needs the members section, a campaign needs
 * the Submissions section.
 */
export type EmailRecipient = EmailTemplateContact;

const RECIPIENT_STATUSES = ["pending", "accepted", "removed"] as const;

/** How many addresses one manual send accepts — a sanity cap, not a quota. */
export const MAX_MANUAL_RECIPIENTS = 50;

const recipientSpecSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("members") }),
  z.object({
    source: z.literal("campaign"),
    campaignId: z.string().uuid(),
    /** Empty means "all statuses". */
    statuses: z.array(z.enum(RECIPIENT_STATUSES)).max(RECIPIENT_STATUSES.length),
    /** null means "either"; true narrows to submissions that were checked in. */
    checkedIn: z.boolean().nullable(),
  }),
  z.object({
    source: z.literal("manual"),
    entries: z
      .array(
        z.object({
          email: z.string().trim().min(1).max(255),
          /** Optional personalization: used for {{name}} / {{first_name}}. */
          name: z.string().trim().max(120).nullable(),
        }),
      )
      .min(1)
      .max(MAX_MANUAL_RECIPIENTS),
  }),
]);

export type EmailRecipientSpec = z.infer<typeof recipientSpecSchema>;

export type ResolvedEmailRecipients = {
  recipients: EmailRecipient[];
  /** Rows dropped for a missing/invalid address, or a duplicate address. */
  skipped: number;
};

const sendTemplateSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "The template is empty.").max(200_000),
  format: z.enum(["html", "text"]),
  recipient: recipientSpecSchema,
});

export type SendTemplateInput = z.infer<typeof sendTemplateSchema>;

/** One send is synchronous, so it stays a job a person can wait out. */
const MAX_RECIPIENTS_PER_SEND = 300;

type RawRow = Record<string, unknown>;

type RegistrationsQuery = PromiseLike<{
  data: RawRow[] | null;
  error: { message: string } | null;
}> & {
  eq: (column: string, value: unknown) => RegistrationsQuery;
  in: (column: string, values: readonly string[]) => RegistrationsQuery;
  order: (column: string, options: { ascending: boolean }) => RegistrationsQuery;
};

const registrationsTable = (supabase: SupabaseClient<Database>) =>
  (
    supabase as unknown as {
      from: (name: string) => { select: (columns: string) => RegistrationsQuery };
    }
  ).from("registrations");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toRecipient(
  firstName: unknown,
  lastName: unknown,
  fullName: unknown,
  email: unknown,
): EmailRecipient | null {
  const cleanEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!cleanEmail || cleanEmail.length > 255 || !EMAIL_PATTERN.test(cleanEmail)) return null;

  let first = String(firstName ?? "").trim();
  let last = String(lastName ?? "").trim();
  if (!first && !last) {
    const split = splitContactName(String(fullName ?? ""));
    first = split.first_name;
    last = split.last_name;
  }
  const name = `${first} ${last}`.trim() || String(fullName ?? "").trim() || cleanEmail;
  return { name, first_name: first, last_name: last, email: cleanEmail };
}

/** De-duplicate by address — the same person can apply to several campaigns. */
function collectRecipients(candidates: (EmailRecipient | null)[]): ResolvedEmailRecipients {
  const seen = new Set<string>();
  const recipients: EmailRecipient[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (!candidate) {
      skipped += 1;
      continue;
    }
    if (seen.has(candidate.email)) {
      skipped += 1;
      continue;
    }
    seen.add(candidate.email);
    recipients.push(candidate);
  }

  return { recipients, skipped };
}

/** Structurally the auth middleware's context — what requireSection takes. */
type EmailContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims?: { email?: string };
};

/**
 * Plain officer check for actions that belong to no single section — the
 * manual recipient list is typeable by any officer, exactly like the old
 * console email tab was.
 */
async function assertAdmin(context: EmailContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Admin access check failed: ${error.message}`);
  if (!data) throw new Error("Not authorized");
}

/** "yasmine.boudiaf@x.dz" → "Yasmine Boudiaf", for a nameless manual address. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return (
    local
      .split(/[._+-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || email
  );
}

async function resolveRecipients(
  context: EmailContext,
  spec: EmailRecipientSpec,
): Promise<ResolvedEmailRecipients> {
  if (spec.source === "manual") {
    await assertAdmin(context);
    return collectRecipients(
      spec.entries.map((entry) => {
        const email = entry.email.trim().toLowerCase();
        return toRecipient(null, null, entry.name?.trim() || nameFromEmail(email), email);
      }),
    );
  }

  if (spec.source === "members") {
    await requireSection(context, "members");
    const { data, error } = await context.supabase
      .from("members")
      .select("full_name, email")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return collectRecipients(
      (data ?? []).map((row) => toRecipient(null, null, row.full_name, row.email)),
    );
  }

  await requireAnySection(context, ...SUBMISSION_SECTIONS);
  let query = registrationsTable(context.supabase)
    .select("first_name, last_name, email")
    .eq("campaign_id", spec.campaignId)
    .order("created_at", { ascending: true });
  if (spec.statuses.length > 0) query = query.in("status", spec.statuses);
  if (spec.checkedIn === true) query = query.eq("checked_in", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return collectRecipients(
    (data ?? []).map((row) => toRecipient(row["first_name"], row["last_name"], null, row["email"])),
  );
}

/** Who a draft currently targets, with names and addresses, for the count. */
export const listEmailRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((spec: EmailRecipientSpec) => recipientSpecSchema.parse(spec))
  .handler(async ({ context, data: spec }) => resolveRecipients(context, spec));

/**
 * Send one template to every resolved recipient, personalizing per address.
 *
 * Personalization happens here, then each chunk of up to 100 goes out in a
 * single batch request — a 75-student run is one call, well inside any
 * serverless timeout, instead of a paced ~40-second loop. A failed chunk is
 * reported back as a list of addresses for the officer to retry.
 */
export const sendTemplateEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SendTemplateInput) => sendTemplateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { recipients, skipped } = await resolveRecipients(context, data.recipient);
    if (recipients.length === 0) {
      throw new Error("No recipients with a valid email address.");
    }
    if (recipients.length > MAX_RECIPIENTS_PER_SEND) {
      throw new Error(
        `Too many recipients (${recipients.length}). Send in batches of at most ${MAX_RECIPIENTS_PER_SEND}.`,
      );
    }

    const { sendClubEmailBatch, RESEND_BATCH_LIMIT } = await import("@/lib/resend.server");
    const { CANONICAL_ORIGIN } = await import("@/lib/app-origin.server");
    const logoUrl = `${CANONICAL_ORIGIN}/wavez-logo-email.png`;

    const failures: string[] = [];
    let sent = 0;

    for (let start = 0; start < recipients.length; start += RESEND_BATCH_LIMIT) {
      const chunk = recipients.slice(start, start + RESEND_BATCH_LIMIT);
      const payloads = chunk.map((recipient) => {
        const subject = renderEmailTemplate(data.subject, recipient, { escape: false, logoUrl });
        const rendered = renderEmailTemplate(data.body, recipient, {
          escape: data.format === "html",
          logoUrl,
        });
        return data.format === "html"
          ? { to: recipient.email, subject, html: rendered }
          : { to: recipient.email, subject, text: rendered };
      });

      const result = await sendClubEmailBatch(payloads);
      if (result.ok) sent += chunk.length;
      else failures.push(...chunk.map((recipient) => recipient.email));
    }

    return { total: recipients.length, sent, failed: failures.length, failures, skipped };
  });

/** The From/Reply-To the next email will carry, shown above the composer. */
export const getEmailSenderInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { describeClubSender } = await import("@/lib/resend.server");
    return describeClubSender();
  });

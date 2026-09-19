import { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Level } from "@/lib/club";
import type { CampaignKind, CampaignQuestion } from "@/lib/registrations";
import { requireSection } from "@/lib/admin-admins-api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdminCampaign = {
  id: string;
  title: string;
  description: string;
  is_open: boolean;
  kind: CampaignKind;
  custom_questions: CampaignQuestion[];
  display_order: number;
  created_at: string;
  /** Number of submissions (all statuses) attached to this campaign. */
  submission_count: number;
};

export type AdminRegistration = {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  department: string;
  email: string;
  phone: string;
  school_year: Level;
  answers: Record<string, string>;
  status: "pending" | "accepted" | "removed";
  decided_at: string | null;
  created_at: string;
  /** Object path in the private `identity-documents` bucket (membership-only). */
  school_certificate_url: string | null;
  /** Object path in the private `identity-documents` bucket (membership-only). */
  identity_card_url: string | null;
  /** Interview check-in flag — tracked for both membership and event kinds. */
  checked_in: boolean;
  /** When they were checked in (null until checked in). */
  checked_in_at: string | null;
};

export type RegistrationDocumentKey = "school_certificate" | "identity_card";

// ─── Loose Supabase wrappers (tables absent from generated types) ───────────

type MutateResult = { error: { message: string } | null };
type SelectResult<T> = { data: T[] | null; error: { message: string } | null };
type SelectChain<T> = {
  eq(column: string, value: unknown): Promise<SelectResult<T>>;
} & PromiseLike<SelectResult<T>>;
type EqChain = {
  eq(column: string, value: unknown): Promise<MutateResult>;
};

type LooseTable = {
  select(columns: string): SelectChain<Record<string, unknown>>;
  insert(row: Record<string, unknown>): Promise<MutateResult>;
  update(patch: Record<string, unknown>): EqChain;
  delete(): EqChain;
};

type LooseDb = { from(table: string): LooseTable };

const campaignsTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("registration_campaigns");
const registrationsTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("registrations");
const membersTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("members");

// ─── Validation ─────────────────────────────────────────────────────────────

const campaignQuestionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1, "Every question needs a label").max(120),
  type: z.enum(["text", "choice"]),
  options: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
});

const saveCampaignInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Title is required").max(120),
    description: z.string().trim().max(300),
    is_open: z.boolean(),
    kind: z.enum(["membership", "event"]),
    display_order: z.number().int().min(0).max(1000),
    custom_questions: z.array(campaignQuestionSchema).max(12),
  })
  .refine(
    (campaign) =>
      campaign.custom_questions.every(
        (question) =>
          question.type !== "choice" ||
          (Array.isArray(question.options) && question.options.length > 0),
      ),
    { message: "Multiple-choice questions need at least one option", path: ["custom_questions"] },
  )
  .refine(
    (campaign) =>
      new Set(campaign.custom_questions.map((question) => question.id)).size ===
      campaign.custom_questions.length,
    { message: "Questions must have unique IDs", path: ["custom_questions"] },
  );

export type SaveCampaignInput = z.infer<typeof saveCampaignInputSchema>;

// ─── Server functions ───────────────────────────────────────────────────────

/** List all campaigns (open and closed) with their submission counts. */
export const listRegistrationCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "registrations");

    const { data: rows, error } = await campaignsTable(supabase).select("*");
    if (error) throw new Error(error.message);

    const { data: registrationRows, error: regError } =
      await registrationsTable(supabase).select("campaign_id");
    if (regError) throw new Error(regError.message);

    const counts = new Map<string, number>();
    for (const row of (registrationRows ?? []) as { campaign_id: string }[]) {
      counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
    }

    const campaigns = ((rows ?? []) as unknown as AdminCampaign[])
      .map((campaign) => ({
        ...campaign,
        submission_count: counts.get(campaign.id) ?? 0,
      }))
      .sort(
        (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at),
      );
    return campaigns;
  });

/** Create or update a campaign. */
export const saveRegistrationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SaveCampaignInput) => input)
  .handler(async ({ context, data: input }) => {
    const { supabase } = await requireSection(context, "registrations");

    const custom_questions = input.custom_questions.map((question) =>
      question.type === "choice"
        ? {
            id: question.id,
            label: question.label.trim(),
            type: question.type,
            options: (question.options ?? []).map((option) => option.trim()),
          }
        : {
            id: question.id,
            label: question.label.trim(),
            type: question.type,
          },
    );

    const payload: Record<string, unknown> = {
      title: input.title.trim(),
      description: input.description.trim(),
      is_open: input.is_open,
      kind: input.kind,
      display_order: input.display_order,
      custom_questions,
    };

    const { error } = input.id
      ? await campaignsTable(supabase).update(payload).eq("id", input.id)
      : await campaignsTable(supabase).insert(payload);
    if (error) throw new Error(error.message);
    return true;
  });

/** Toggle a campaign open/closed from the list view. */
export const setCampaignOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; is_open: boolean }) => input)
  .handler(async ({ context, data: { id, is_open } }) => {
    const { supabase } = await requireSection(context, "registrations");
    const { error } = await campaignsTable(supabase).update({ is_open }).eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

/** Delete a campaign. Callers confirm first — submissions are cascade-deleted. */
export const deleteRegistrationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireSection(context, "registrations");
    const { error } = await campaignsTable(supabase).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

/** List submissions for one campaign, newest first. */
export const listCampaignRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((campaignId: string) => campaignId)
  .handler(async ({ context, data: campaignId }) => {
    const { supabase } = await requireSection(context, "registrations");
    const { data, error } = await registrationsTable(supabase)
      .select("*")
      .eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as AdminRegistration[]).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return rows;
  });

/**
 * Accept a pending registration.
 * Membership drives → a matching member row is created.
 * Event sign-ups → just marked accepted (no Members row — they join for the event only).
 */
export const acceptRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((registrationId: string) => registrationId)
  .handler(async ({ context, data: registrationId }) => {
    const { supabase } = await requireSection(context, "registrations");

    const { data } = await registrationsTable(supabase).select("*").eq("id", registrationId);
    const registration = (data ?? [])[0] as unknown as AdminRegistration | undefined;
    if (!registration) throw new Error("Submission not found.");
    if (registration.status !== "pending") {
      throw new Error("This submission has already been processed.");
    }

    const { data: campaignRows } = await campaignsTable(supabase)
      .select("kind")
      .eq("id", registration.campaign_id);
    const kind = (campaignRows ?? [])[0]?.["kind"] as CampaignKind | undefined;

    if (kind === "membership") {
      const member: Record<string, unknown> = {
        full_name: `${registration.first_name} ${registration.last_name}`.trim(),
        email: registration.email.toLowerCase(),
        phone: registration.phone,
        level: registration.school_year,
        department: registration.department,
        status: "active",
        school_certificate_url: registration.school_certificate_url ?? null,
        identity_card_url: registration.identity_card_url ?? null,
      };
      const { error: memberError } = await membersTable(supabase).insert(member);
      if (memberError) throw new Error(memberError.message);
    }

    const { error: updateError } = await registrationsTable(supabase)
      .update({ status: "accepted", decided_at: new Date().toISOString() })
      .eq("id", registrationId);
    if (updateError) throw new Error(updateError.message);

    return true;
  });

/** Mark a registration as removed — it stays out of Members. */
export const removeRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((registrationId: string) => registrationId)
  .handler(async ({ context, data: registrationId }) => {
    const { supabase } = await requireSection(context, "registrations");
    const { error } = await registrationsTable(supabase)
      .update({ status: "removed", decided_at: new Date().toISOString() })
      .eq("id", registrationId);
    if (error) throw new Error(error.message);
    return true;
  });

/** Toggle interview check-in. Low-stakes: no confirmation, instant undo. */
export const toggleRegistrationCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; checked_in: boolean }) => input)
  .handler(async ({ context, data: { id, checked_in } }) => {
    const { supabase } = await requireSection(context, "registrations");
    const { error } = await registrationsTable(supabase)
      .update({
        checked_in,
        checked_in_at: checked_in ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

/**
 * Build a short-lived signed URL for one uploaded registration document so the
 * admin can open it in a new tab. The document stays in the private
 * `identity-documents` bucket — only the link is exposed, for 10 minutes.
 */
export const getRegistrationDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { registrationId: string; document: RegistrationDocumentKey }) => input)
  .handler(async ({ context, data: { registrationId, document } }) => {
    const { supabase } = await requireSection(context, "registrations");

    const column =
      document === "school_certificate" ? "school_certificate_url" : "identity_card_url";
    const { data } = await registrationsTable(supabase).select(column).eq("id", registrationId);
    const path = (data ?? [])[0]?.[column] as string | null | undefined;
    if (!path) throw new Error("This submission has no document uploaded.");

    const { error, data: signedData } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(path, 600);
    if (error) throw new Error(error.message);
    if (!signedData) throw new Error("Could not create a signed link for this document.");
    return signedData.signedUrl;
  });

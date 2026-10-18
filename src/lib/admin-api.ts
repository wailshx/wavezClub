import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  ANNOUNCEMENT_KIND,
  CAMPAIGN_KIND_FOR_SUBMISSION,
  isOpenSubmissionType,
  isSubmissionType,
  type SubmissionType,
} from "@/lib/announcements";
import {
  MAX_CUSTOM_QUESTIONS,
  type CampaignKind,
  type CampaignQuestion,
} from "@/lib/registrations";
import { MAX_LEADER_DESCRIPTION } from "@/lib/leaders";
import { isValidLinkedinUrl, TEAM_CATEGORIES, type TeamCategory } from "@/lib/team";
import { requireAnySection, requireSection, SUBMISSION_SECTIONS } from "@/lib/admin-admins-api";
import { DEPARTMENTS, isClubRole, LEVELS, SPECIALITIES, type ClubRole } from "@/lib/club";
import {
  assertClubRoleAvailable,
  exclusiveRoleConflictError,
  isExclusiveRoleConflict,
} from "@/lib/club-roles";

export type MemberLevel = "L1" | "L2" | "L3" | "M1" | "M2";

export type AdminMember = {
  id: string;
  full_name: string;
  age: number | null;
  email: string;
  phone: string;
  speciality: string | null;
  level: MemberLevel;
  department: string;
  status: string;
  admin_role: string | null;
  /** Club-side role (President, Media Member, …) — separate from `admin_role`. */
  club_role: ClubRole | null;
  blocked_until: string | null;
  created_at: string;
  /** Object path in the private `identity-documents` bucket (nullable — optional uploads). */
  school_certificate_url: string | null;
  /** Object path in the private `identity-documents` bucket (nullable — optional uploads). */
  identity_card_url: string | null;
};

export type MemberDocumentKey = "school_certificate" | "identity_card";

/**
 * An announcement in the admin console. `kind` is fixed to `registration` (the
 * event/news types were retired in migration 0016); `submission_type` is what
 * describes the row — open day, event, plain information, or a teaser for a
 * submission that opens later (migration 0022).
 */
export type AdminPost = {
  id: string;
  kind: typeof ANNOUNCEMENT_KIND;
  title: string;
  subtitle: string;
  body: string;
  location: string | null;
  event_date: string | null;
  submission_type: SubmissionType;
  /** When a `soon` teaser opens; null for every other announcement. */
  opens_at: string | null;
  /** Campaign the public card submits to; null until one is linked. */
  campaign_id: string | null;
  is_pinned: boolean;
  published: boolean;
  created_at: string;
};

/**
 * The application settings that belong to an announcement.
 *
 * These used to live on a separate `registration_campaigns` row edited from
 * their own admin tab. They are now part of the announcement itself, because
 * the card *is* the application: an open day and its membership wizard cannot be
 * created, edited or reasoned about separately without the two drifting apart.
 */
export type AdminPostCampaign = {
  /** Whether the public card offers the form at all. */
  is_open: boolean;
  custom_questions: CampaignQuestion[];
};

export type AdminEmailDraft = {
  id: string;
  subject: string;
  body: string;
  recipient_ids: string[];
  created_by: string;
  created_at: string;
};

export type AdminLeader = {
  id: string;
  name: string;
  position: string;
  description: string;
  image_url: string;
  display_order: number;
  created_at: string;
};

export type AdminTeamMember = {
  id: string;
  name: string;
  role_title: string;
  category: TeamCategory;
  avatar_url: string;
  bio: string | null;
  linkedin_url: string | null;
  display_order: number;
  created_at: string;
};

type AdminContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

type MemberBlockUpdate = {
  update: (patch: Record<string, unknown>) => {
    eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

type UserRoleRow = {
  user_id: string;
  admin_role: string | null;
};

type LooseError = { message: string; code?: string; details?: string };

type LooseResponse = { error: LooseError | null; data?: unknown };

type LooseTable = {
  select: (columns: string) => Promise<LooseResponse>;
  insert: (rows: Record<string, unknown>) => Promise<{ error: LooseError | null }>;
  update: (patch: Record<string, unknown>) => {
    eq: (column: string, value: unknown) => Promise<{ error: LooseError | null }>;
  };
  delete: () => {
    eq: (column: string, value: unknown) => Promise<{ error: LooseError | null }>;
  };
};

type LooseDb = { from: (table: string) => LooseTable };

const emailDraftTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("admin_email_drafts");

const leadersTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("leaders");

const teamTable = (supabase: SupabaseClient<Database>) =>
  (supabase as unknown as LooseDb).from("team_members");

/**
 * Read a campaign's kind. `registration_campaigns` is not part of the
 * hand-trimmed `Database` type, and `LooseTable` cannot chain filters, so this
 * one lookup carries its own minimal shape instead of widening the shared type.
 */
/**
 * Read the campaign an announcement points at, or null.
 *
 * The hand-trimmed generated types do not include `registration_campaigns`, so
 * the table is reached through a local structural type.
 */
async function readCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string,
): Promise<{ id: string; kind: string } | null> {
  const table = (
    supabase as unknown as {
      from: (name: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { id: string; kind: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  ).from("registration_campaigns");

  const { data, error } = await table.select("id, kind").eq("id", campaignId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Create or update the campaign that backs an announcement's application form. */
async function writeCampaign(
  supabase: SupabaseClient<Database>,
  args: {
    existingId: string | null;
    title: string;
    description: string;
    kind: CampaignKind;
    is_open: boolean;
    custom_questions: CampaignQuestion[];
  },
): Promise<string> {
  const table = (
    supabase as unknown as {
      from: (name: string) => {
        insert: (row: object) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
        update: (row: object) => {
          eq: (
            column: string,
            value: string,
          ) => {
            select: (columns: string) => {
              single: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  ).from("registration_campaigns");

  // The title and description are mirrors of the announcement: the campaign is
  // the storage for the application, the post is what the student reads. Keeping
  // one source of truth is why this can no longer drift out of sync.
  const row = {
    title: args.title,
    description: args.description,
    kind: args.kind,
    is_open: args.is_open,
    custom_questions: args.custom_questions,
  };

  if (args.existingId) {
    const { data, error } = await table.update(row).eq("id", args.existingId).select("id").single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not update the application form for this announcement");
    return data.id;
  }

  const { data, error } = await table.insert(row).select("id").single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create the application form for this announcement");
  return data.id;
}

/**
 * Close the campaign an announcement keeps while it is an `announcement` or a
 * `soon` teaser, mirroring the title/subtitle like `writeCampaign` does.
 *
 * Deliberately does *not* delete or re-kind the row: its submissions are the
 * record of who applied, and switching the announcement back to a submission
 * must reopen this same campaign with those submissions intact. A failure here
 * fails the save — closing is what keeps the dashboard's open-campaign count
 * and the public card honest for a post that no longer accepts applications.
 */
async function closeKeptCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  mirror: { title: string; description: string },
): Promise<void> {
  const table = (
    supabase as unknown as {
      from: (name: string) => {
        update: (row: object) => {
          eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
        };
      };
    }
  ).from("registration_campaigns");

  const { error } = await table
    .update({
      title: mirror.title,
      description: mirror.description,
      is_open: false,
    })
    .eq("id", campaignId);
  if (error) throw new Error(`Could not close the linked registration: ${error.message}`);
}

async function requireAdmin(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) {
    console.error("[requireAdmin] has_role RPC error", {
      userId: context.userId,
      error: error.message,
    });
    throw new Error(`Admin access check failed: ${error.message}`);
  }
  if (!data) throw new Error("Not authorized");
  return context;
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) {
      console.error("[getAdminStatus] has_role RPC error", {
        userId: context.userId,
        error: error.message,
      });
      throw error;
    }
    const hasAdmin = Boolean(data);
    console.log("[getAdminStatus]", { userId: context.userId, hasAdmin });
    return hasAdmin;
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "members");
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const roles = await (
      supabase.from("user_roles") as unknown as {
        select: (
          columns: string,
        ) => Promise<{ data: UserRoleRow[] | null; error: { message: string } | null }>;
      }
    ).select("user_id, admin_role");
    if (roles.error) throw new Error(roles.error.message);

    const roleMap = new Map(
      (roles.data ?? [])
        .filter((row) => row.admin_role !== null)
        .map((row) => [row.user_id, row.admin_role]),
    );

    return (data ?? []).map((member) => ({
      ...member,
      admin_role: roleMap.get(member.id) ?? null,
    })) as unknown as AdminMember[];
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((member: AdminMember) => member)
  .handler(async ({ context, data: member }) => {
    const { supabase } = await requireSection(context, "members");

    const clubRole = member.club_role ?? null;
    if (clubRole !== null && !isClubRole(clubRole)) {
      throw new Error("Choose a valid club role.");
    }
    // Keeping your own one-person role is fine; taking someone else's is not.
    await assertClubRoleAvailable(supabase, clubRole, { allowMemberId: member.id });

    const { error } = await (supabase.from("members") as unknown as LooseTable)
      .update({
        full_name: member.full_name,
        age: member.age,
        email: member.email,
        phone: member.phone,
        speciality: member.speciality,
        level: member.level,
        department: member.department,
        status: member.status,
        club_role: clubRole,
      })
      .eq("id", member.id);
    if (error) {
      if (clubRole && isExclusiveRoleConflict(error)) {
        throw await exclusiveRoleConflictError(supabase, clubRole);
      }
      throw new Error(error.message);
    }
    return true;
  });

export type CreateMemberInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  level: MemberLevel;
  department: string;
  speciality: string | null;
  club_role: ClubRole | null;
};

/**
 * Add a member by hand — for someone who joined at the door, with no
 * application in any campaign.
 *
 * The public membership flow is three steps (profile → documents → questions);
 * this collects only the profile step. The documents are uploaded by the
 * applicant themselves, and the custom questions belong to a campaign this
 * member never applied to. The row lands `active` — the same shape
 * `acceptRegistration` writes — so nothing downstream can tell the two apart.
 *
 * `members.email` carries a unique index on lower(email) (migration 0018), so a
 * duplicate is refused here with names attached instead of a raw constraint
 * error; the constraint itself is still caught, because the address can be
 * taken between the check and the insert.
 */
export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: CreateMemberInput) => input)
  .handler(async ({ context, data: input }) => {
    const { supabase } = await requireSection(context, "members");

    const firstName = input.first_name.trim();
    const lastName = input.last_name.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    const department = input.department.trim();
    const speciality = input.speciality?.trim() || null;

    if (!firstName) throw new Error("First name is required.");
    if (!lastName) throw new Error("Last name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      throw new Error("Enter a valid email address.");
    }
    if (phone.length < 6) throw new Error("Enter a valid phone number.");
    if (!(LEVELS as readonly string[]).includes(input.level)) {
      throw new Error("Choose a valid level.");
    }
    if (!(DEPARTMENTS as readonly string[]).includes(department)) {
      throw new Error("Choose a valid department.");
    }
    if (speciality && !(SPECIALITIES as readonly string[]).includes(speciality)) {
      throw new Error("Choose a valid speciality.");
    }
    const clubRole = input.club_role ?? null;
    if (clubRole !== null && !isClubRole(clubRole)) {
      throw new Error("Choose a valid club role.");
    }

    const table = (
      supabase as unknown as {
        from: (name: string) => {
          select: (columns: string) => {
            ilike: (
              column: string,
              pattern: string,
            ) => PromiseLike<{
              data: Record<string, unknown>[] | null;
              error: { message: string } | null;
            }>;
          };
          insert: (row: Record<string, unknown>) => {
            select: (columns: string) => {
              single: () => PromiseLike<{
                data: Record<string, unknown> | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      }
    ).from("members");

    // `_` and `%` are LIKE wildcards and both are legal in an email address, so
    // they have to be escaped for this to be an exact case-insensitive hit.
    const pattern = email.replace(/([\\%_])/g, "\\$1");
    const { data: rows, error: lookupError } = await table
      .select("id, full_name")
      .ilike("email", pattern);
    if (lookupError) throw new Error(lookupError.message);
    const existing = (rows ?? [])[0];
    if (existing) {
      const existingName = ((existing["full_name"] as string | undefined) ?? "").trim() || email;
      throw new Error(`${existingName} is already a member (${email}).`);
    }

    // One-person roles can only be held once. The pre-check names the holder;
    // the partial unique index is what holds when two adds race (below).
    await assertClubRoleAvailable(supabase, clubRole);

    const full_name = `${firstName} ${lastName}`.trim();
    const { data: inserted, error } = await table
      .insert({
        full_name,
        email,
        phone,
        level: input.level,
        department,
        speciality,
        status: "active",
        club_role: clubRole,
      })
      .select("*")
      .single();
    if (error) {
      if (clubRole && isExclusiveRoleConflict(error)) {
        throw await exclusiveRoleConflictError(supabase, clubRole);
      }
      if (error.code === "23505") {
        throw new Error(`${full_name} is already a member (${email}).`);
      }
      throw new Error(error.message);
    }
    if (!inserted) throw new Error("Could not add this member.");

    return { ...inserted, admin_role: null } as unknown as AdminMember;
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireSection(context, "members");
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const blockMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; until: string }) => data)
  .handler(async ({ context, data: { id, until } }) => {
    const { supabase } = await requireSection(context, "members");
    if (!until || Number.isNaN(new Date(until).getTime())) {
      throw new Error("Invalid block duration");
    }
    const { error } = await (supabase.from("members") as unknown as MemberBlockUpdate)
      .update({ blocked_until: new Date(until).toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const unblockMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireSection(context, "members");
    const { error } = await (supabase.from("members") as unknown as MemberBlockUpdate)
      .update({ blocked_until: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

/**
 * Build a short-lived signed URL for one document stored on a member record so
 * the admin can open it in a new tab. Mirrors the registration document link
 * flow — the file stays in the private `identity-documents` bucket and only a
 * 10-minute link is exposed.
 */
export const getMemberDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { memberId: string; document: MemberDocumentKey }) => input)
  .handler(async ({ context, data: { memberId, document } }) => {
    const { supabase } = await requireSection(context, "members");

    const column =
      document === "school_certificate" ? "school_certificate_url" : "identity_card_url";
    const { data, error } = await supabase.from("members").select(column).eq("id", memberId);
    if (error) throw new Error(error.message);
    const path = ((data ?? [])[0] as Record<string, unknown> | undefined)?.[column] as
      string | null | undefined;
    if (!path) throw new Error("This member has no document on file.");

    const { error: signedError, data: signedData } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(path, 600);
    if (signedError) throw new Error(signedError.message);
    if (!signedData) throw new Error("Could not create a signed link for this document.");
    return signedData.signedUrl;
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAnySection(context, ...SUBMISSION_SECTIONS);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminPost[];
  });

const MAX_TITLE = 140;
const MAX_SUBTITLE = 180;
const MAX_BODY = 4000;
const MAX_LOCATION = 160;

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((post: AdminPost & { campaign: AdminPostCampaign }) => post)
  .handler(async ({ context, data: post }) => {
    const { supabase } = await requireAnySection(context, ...SUBMISSION_SECTIONS);

    const title = post.title.trim();
    if (!title) throw new Error("Title is required");
    if (!isSubmissionType(post.submission_type)) {
      throw new Error("Choose an announcement type: open day, event, announcement or opening soon");
    }
    const parsedDate = post.event_date ? new Date(post.event_date) : null;
    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date & time");
    }
    const parsedOpensAt = post.opens_at ? new Date(post.opens_at) : null;
    if (parsedOpensAt && Number.isNaN(parsedOpensAt.getTime())) {
      throw new Error("Invalid opening date");
    }
    if (post.campaign.custom_questions.length > MAX_CUSTOM_QUESTIONS) {
      throw new Error(`At most ${MAX_CUSTOM_QUESTIONS} questions per submission`);
    }

    // An announcement and its application are saved as one unit, so the kind is
    // derived from the announcement type rather than chosen separately: an open
    // day can only ever drive a membership campaign, an event an event one.
    const kind = CAMPAIGN_KIND_FOR_SUBMISSION[post.submission_type];
    const isSubmission = isOpenSubmissionType(post.submission_type);

    // Reuse the campaign this announcement already owns. An announcement created
    // before this merge can have none, in which case one is created for it.
    let existingCampaignId: string | null = post.campaign_id ?? null;
    let existingCampaign: { id: string; kind: string } | null = null;
    if (existingCampaignId) {
      existingCampaign = await readCampaign(supabase, existingCampaignId);
      if (!existingCampaign) existingCampaignId = null;
    }

    let campaignId: string | null;
    if (isSubmission) {
      if (!kind) throw new Error("This type does not take a registration form");

      // A stale tab can hold a campaign attached under a different type.
      // Re-kinding it silently would swap the form under students who already
      // applied, so the mismatch is refused instead — the admin attaches a
      // matching registration (the picker only offers those) or removes the link.
      if (existingCampaign && existingCampaign.kind !== kind) {
        const attached = existingCampaign.kind === "membership" ? "an open-day" : "an event";
        const wanted = kind === "membership" ? "an open-day" : "an event";
        throw new Error(
          `This announcement is linked to ${attached} registration, but this type needs ${wanted} one — attach a matching registration or remove the link.`,
        );
      }

      campaignId = await writeCampaign(supabase, {
        existingId: existingCampaignId,
        title: title.slice(0, MAX_TITLE),
        description: post.subtitle.trim().slice(0, MAX_SUBTITLE),
        kind,
        is_open: post.campaign.is_open === true,
        custom_questions: post.campaign.custom_questions,
      });
    } else {
      // `announcement` / `soon`: no form, so nothing new is created. A campaign
      // that is already linked stays linked — closed, never deleted — so its
      // submissions survive and switching back reopens the same registration.
      campaignId = existingCampaignId;
      if (campaignId) {
        await closeKeptCampaign(supabase, campaignId, {
          title: title.slice(0, MAX_TITLE),
          description: post.subtitle.trim().slice(0, MAX_SUBTITLE),
        });
      }
    }

    const payload = {
      kind: ANNOUNCEMENT_KIND,
      title: title.slice(0, MAX_TITLE),
      subtitle: post.subtitle.trim().slice(0, MAX_SUBTITLE),
      body: post.body.trim().slice(0, MAX_BODY),
      location: post.location?.trim() ? post.location.trim().slice(0, MAX_LOCATION) : null,
      event_date: parsedDate ? parsedDate.toISOString() : null,
      submission_type: post.submission_type,
      opens_at: parsedOpensAt ? parsedOpensAt.toISOString() : null,
      campaign_id: campaignId,
      is_pinned: post.is_pinned === true,
      published: post.published === true,
    };

    // `opens_at` (migration 0022) is newer than the hand-trimmed generated
    // types, so the table is reached structurally — the same treatment
    // `registration_campaigns` already gets here.
    const postsTable = (
      supabase as unknown as {
        from: (name: string) => {
          insert: (row: object) => PromiseLike<{ error: { message: string } | null }>;
          update: (row: object) => {
            eq: (
              column: string,
              value: string,
            ) => PromiseLike<{ error: { message: string } | null }>;
          };
        };
      }
    ).from("posts");

    const { error } = post.id
      ? await postsTable.update(payload).eq("id", post.id)
      : await postsTable.insert(payload);
    if (error) throw new Error(error.message);
    return true;
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireAnySection(context, ...SUBMISSION_SECTIONS);
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const listEmailDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
    const { data, error } = await emailDraftTable(supabase).select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminEmailDraft[];
  });

export const saveEmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { id: string | null; subject: string; body: string; recipientIds: string[] }) => data,
  )
  .handler(async ({ context, data: { id, subject, body, recipientIds } }) => {
    const { supabase } = await requireAdmin(context);
    const payload = {
      subject: subject.trim(),
      body: body.trim(),
      recipient_ids: recipientIds,
    };
    const table = emailDraftTable(supabase);
    if (!payload.subject && !payload.body && recipientIds.length === 0) {
      throw new Error("Empty draft — nothing to save");
    }
    const { error } = id
      ? await table.update(payload).eq("id", id)
      : await table.insert({ ...payload, created_by: context.userId });
    if (error) throw new Error(error.message);
    return true;
  });

export const deleteEmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireAdmin(context);
    const { error } = await emailDraftTable(supabase).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { recipients: string[]; subject: string; body: string }) => data)
  .handler(async ({ context, data: { recipients, subject, body } }) => {
    await requireAdmin(context);

    // Each recipient gets the same copy; failures are logged server-side.
    // Sent as the club (CLUB_EMAIL) since this is club↔member communication.
    const { sendClubEmail } = await import("@/lib/resend.server");
    let sent = 0;
    for (const to of recipients) {
      const result = await sendClubEmail({ to, subject: subject.trim(), text: body.trim() });
      if (result.ok) sent += 1;
    }
    return { sent };
  });

export const listLeaders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "leaders");
    const { data, error } = await leadersTable(supabase).select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AdminLeader[]).sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
    );
  });

export const saveLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((leader: AdminLeader) => leader)
  .handler(async ({ context, data: leader }) => {
    const { supabase } = await requireSection(context, "leaders");
    const name = leader.name.trim();
    const position = leader.position.trim();
    const description = (leader.description ?? "").trim().slice(0, MAX_LEADER_DESCRIPTION);
    const image_url = leader.image_url.trim();
    if (!name) throw new Error("Name is required");
    if (!position) throw new Error("Position is required");
    if (!image_url) throw new Error("Photo is required");
    const payload = {
      name,
      position,
      description,
      image_url,
      display_order: Number.isFinite(Number(leader.display_order))
        ? Math.trunc(Number(leader.display_order))
        : 0,
    };
    const { error } = leader.id
      ? await leadersTable(supabase).update(payload).eq("id", leader.id)
      : await leadersTable(supabase).insert(payload);
    if (error) throw new Error(error.message);
    return true;
  });

export const deleteLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireSection(context, "leaders");
    const { error } = await leadersTable(supabase).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const saveLeaderOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((rows: { id: string; display_order: number }[]) => rows)
  .handler(async ({ context, data: rows }) => {
    const { supabase } = await requireSection(context, "leaders");
    for (const row of rows) {
      const { error } = await leadersTable(supabase)
        .update({
          display_order: Number.isFinite(Number(row.display_order))
            ? Math.trunc(Number(row.display_order))
            : 0,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
    return true;
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "team");
    const { data, error } = await teamTable(supabase).select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AdminTeamMember[]).sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
    );
  });

export const saveTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((member: AdminTeamMember) => member)
  .handler(async ({ context, data: member }) => {
    const { supabase } = await requireSection(context, "team");
    const name = member.name.trim();
    const role_title = member.role_title.trim();
    const avatar_url = member.avatar_url.trim();
    const linkedin_url = (member.linkedin_url ?? "").trim() || null;
    const bio = (member.bio ?? "").trim() || null;
    if (!name) throw new Error("Name is required");
    if (!role_title) throw new Error("Role title is required");
    if (role_title.length > 80) {
      throw new Error("Role title must be 80 characters or fewer. Move the rest into Bio.");
    }
    if (!avatar_url) throw new Error("Photo is required");
    if (!TEAM_CATEGORIES.some((entry) => entry.value === member.category)) {
      throw new Error("Invalid category");
    }
    if (bio && bio.length > 600) throw new Error("Bio must be 600 characters or fewer.");
    if (linkedin_url && !isValidLinkedinUrl(linkedin_url)) {
      throw new Error("LinkedIn must be a valid linkedin.com URL");
    }
    const payload = {
      name,
      role_title,
      category: member.category,
      avatar_url,
      bio,
      linkedin_url,
      display_order: Number.isFinite(Number(member.display_order))
        ? Math.trunc(Number(member.display_order))
        : 0,
    };
    const { error } = member.id
      ? await teamTable(supabase).update(payload).eq("id", member.id)
      : await teamTable(supabase).insert(payload);
    if (error) throw new Error(error.message);
    return true;
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { supabase } = await requireSection(context, "team");
    const { error } = await teamTable(supabase).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const saveTeamOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((rows: { id: string; display_order: number }[]) => rows)
  .handler(async ({ context, data: rows }) => {
    const { supabase } = await requireSection(context, "team");
    for (const row of rows) {
      const { error } = await teamTable(supabase)
        .update({
          display_order: Number.isFinite(Number(row.display_order))
            ? Math.trunc(Number(row.display_order))
            : 0,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
    return true;
  });

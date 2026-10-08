import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  ANNOUNCEMENT_KIND,
  CAMPAIGN_KIND_FOR_SUBMISSION,
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
  blocked_until: string | null;
  created_at: string;
  /** Object path in the private `identity-documents` bucket (nullable — optional uploads). */
  school_certificate_url: string | null;
  /** Object path in the private `identity-documents` bucket (nullable — optional uploads). */
  identity_card_url: string | null;
};

export type MemberDocumentKey = "school_certificate" | "identity_card";

/**
 * An announcement in the admin console. `kind` is fixed to `registration` — the
 * event/news types are retired (migration 0016) and every announcement now
 * exists to announce an open submission.
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

type LooseResponse = { error: { message: string } | null; data?: unknown };

type LooseTable = {
  select: (columns: string) => Promise<LooseResponse>;
  insert: (rows: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  update: (patch: Record<string, unknown>) => {
    eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
  };
  delete: () => {
    eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
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
      })
      .eq("id", member.id);
    if (error) throw new Error(error.message);
    return true;
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
      throw new Error("Choose whether this is an open day or an event submission");
    }
    const parsedDate = post.event_date ? new Date(post.event_date) : null;
    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date & time");
    }
    if (post.campaign.custom_questions.length > MAX_CUSTOM_QUESTIONS) {
      throw new Error(`At most ${MAX_CUSTOM_QUESTIONS} questions per submission`);
    }

    // An announcement and its application are saved as one unit, so the kind is
    // derived from the announcement type rather than chosen separately: an open
    // day can only ever drive a membership campaign, an event an event one.
    const kind = CAMPAIGN_KIND_FOR_SUBMISSION[post.submission_type];

    // Reuse the campaign this announcement already owns. An announcement created
    // before this merge can have none, in which case one is created for it.
    let existingCampaignId: string | null = post.campaign_id ?? null;
    if (existingCampaignId) {
      const existing = await readCampaign(supabase, existingCampaignId);
      if (!existing) existingCampaignId = null;
    }

    const campaignId = await writeCampaign(supabase, {
      existingId: existingCampaignId,
      title: title.slice(0, MAX_TITLE),
      description: post.subtitle.trim().slice(0, MAX_SUBTITLE),
      kind,
      is_open: post.campaign.is_open === true,
      custom_questions: post.campaign.custom_questions,
    });

    const payload = {
      kind: ANNOUNCEMENT_KIND,
      title: title.slice(0, MAX_TITLE),
      subtitle: post.subtitle.trim().slice(0, MAX_SUBTITLE),
      body: post.body.trim().slice(0, MAX_BODY),
      location: post.location?.trim() ? post.location.trim().slice(0, MAX_LOCATION) : null,
      event_date: parsedDate ? parsedDate.toISOString() : null,
      submission_type: post.submission_type,
      campaign_id: campaignId,
      is_pinned: post.is_pinned === true,
      published: post.published === true,
    };

    const { error } = post.id
      ? await supabase.from("posts").update(payload).eq("id", post.id)
      : await supabase.from("posts").insert(payload);
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
    if (!name) throw new Error("Name is required");
    if (!role_title) throw new Error("Role title is required");
    if (!avatar_url) throw new Error("Photo is required");
    if (!TEAM_CATEGORIES.some((entry) => entry.value === member.category)) {
      throw new Error("Invalid category");
    }
    if (linkedin_url && !isValidLinkedinUrl(linkedin_url)) {
      throw new Error("LinkedIn must be a valid linkedin.com URL");
    }
    const payload = {
      name,
      role_title,
      category: member.category,
      avatar_url,
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

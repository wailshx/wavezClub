import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type MemberLevel = "L1" | "L2" | "L3" | "M1" | "M2";

export type AdminMember = {
  id: string;
  full_name: string;
  age: number;
  email: string;
  phone: string;
  speciality: string;
  level: MemberLevel;
  department: string;
  status: string;
  admin_role: string | null;
  blocked_until: string | null;
  created_at: string;
};

export type AdminPost = {
  id: string;
  kind: "event" | "news";
  title: string;
  body: string;
  location: string | null;
  event_date: string | null;
  published: boolean;
  created_at: string;
};

export type AdminEmailDraft = {
  id: string;
  subject: string;
  body: string;
  recipient_ids: string[];
  created_by: string;
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

async function requireAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Not authorized");
  return context;
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return Boolean(data);
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
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
    const { supabase } = await requireAdmin(context);
    const { error } = await supabase
      .from("members")
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
    const { supabase } = await requireAdmin(context);
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const blockMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; until: string }) => data)
  .handler(async ({ context, data: { id, until } }) => {
    const { supabase } = await requireAdmin(context);
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
    const { supabase } = await requireAdmin(context);
    const { error } = await (supabase.from("members") as unknown as MemberBlockUpdate)
      .update({ blocked_until: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((post: AdminPost) => post)
  .handler(async ({ context, data: post }) => {
    const { supabase } = await requireAdmin(context);
    const payload = {
      kind: post.kind,
      title: post.title.trim(),
      body: post.body.trim(),
      location: post.location?.trim() ? post.location.trim() : null,
      event_date: post.event_date ? new Date(post.event_date).toISOString() : null,
      published: post.published,
    };
    if (!payload.title) throw new Error("Title is required");
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
    const { supabase } = await requireAdmin(context);
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

    console.log("[EMAIL-STUB]", {
      to: recipients,
      subject: subject.trim(),
      body: body.trim(),
    });
    return { sent: recipients.length };
  });

import type { SupabaseClient } from "@supabase/supabase-js";

export const TEAM_CATEGORIES = [
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor / Staff" },
  { value: "administration", label: "Administration" },
] as const;

export type TeamCategory = (typeof TEAM_CATEGORIES)[number]["value"];

export function teamCategoryLabel(category: TeamCategory): string {
  return TEAM_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

export type ClubTeamMember = {
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

export const TEAM_PUBLIC_LIMIT = 36;

const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/(in|company|school)\/[A-Za-z0-9._%-]+\/?$/i;

export function isValidLinkedinUrl(value: string): boolean {
  return LINKEDIN_RE.test(value.trim());
}

type LooseResponse = { error: { message: string } | null; data?: unknown };
type LooseOrderable = {
  order: (column: string, options?: { ascending: boolean }) => LooseOrderable;
  limit: (count: number) => Promise<LooseResponse>;
};
type LooseFrom = {
  from: (table: string) => LooseOrderable & { select: (columns: string) => LooseOrderable };
};

export async function fetchPublicTeamMembers(client: SupabaseClient): Promise<ClubTeamMember[]> {
  const loose = client as unknown as LooseFrom;
  const { data, error } = await loose
    .from("team_members")
    .select(
      "id, name, role_title, category, avatar_url, bio, linkedin_url, display_order, created_at",
    )
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(TEAM_PUBLIC_LIMIT);
  if (error) throw error;
  return (data ?? []) as ClubTeamMember[];
}

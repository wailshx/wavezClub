import type { SupabaseClient } from "@supabase/supabase-js";

export type ClubLeader = {
  id: string;
  name: string;
  position: string;
  description: string;
  image_url: string;
  display_order: number;
  created_at: string;
};

export const MAX_LEADER_DESCRIPTION = 200;
export const LEADERS_PUBLIC_LIMIT = 24;

type LooseResponse = { error: { message: string } | null; data?: unknown };
type LooseOrderable = {
  order: (column: string, options?: { ascending: boolean }) => LooseOrderable;
  limit: (count: number) => Promise<LooseResponse>;
};
type LooseFrom = {
  from: (table: string) => LooseOrderable & { select: (columns: string) => LooseOrderable };
};

export function leaderInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export async function fetchPublicLeaders(client: SupabaseClient): Promise<ClubLeader[]> {
  const loose = client as unknown as LooseFrom;
  const { data, error } = await loose
    .from("leaders")
    .select("id, name, position, description, image_url, display_order, created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(LEADERS_PUBLIC_LIMIT);
  if (error) throw error;
  return (data ?? []) as ClubLeader[];
}

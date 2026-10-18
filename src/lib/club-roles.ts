import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { CLUB_ROLE_LABELS, isExclusiveClubRole, type ClubRole } from "@/lib/club";

/**
 * Helpers for `members.club_role`, shared by every write path that can set it:
 * accepting a submission, adding a member by hand, and editing a member.
 *
 * The one-person roles are enforced by `members_exclusive_club_role_idx`
 * (migration `0027`). The pre-insert checks below exist to name the holder in
 * the error — the index is what makes the rule true under two concurrent
 * accepts, and its `23505` is translated by `exclusiveRoleConflictError`.
 */
const EXCLUSIVE_ROLE_INDEX = "members_exclusive_club_role_idx";

type RoleMemberRow = { id: string; full_name: string };

type LookupResult = {
  data: RoleMemberRow[] | null;
  error: { message: string } | null;
};

const membersTable = (supabase: SupabaseClient<Database>) =>
  (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => Promise<LookupResult>;
        };
      };
    }
  ).from("members");

/** The member currently holding a one-person role, or null. */
export async function findClubRoleHolder(
  supabase: SupabaseClient<Database>,
  role: ClubRole,
): Promise<RoleMemberRow | null> {
  const { data, error } = await membersTable(supabase)
    .select("id, full_name")
    .eq("club_role", role);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/**
 * Refuse to hand out a one-person role that someone else already holds.
 * `allowMemberId` is the row being edited — keeping your own role is fine.
 * No-ops for `null` and for the multi-person roles, which have no limit.
 */
export async function assertClubRoleAvailable(
  supabase: SupabaseClient<Database>,
  role: ClubRole | null,
  options: { allowMemberId?: string } = {},
): Promise<void> {
  if (!role || !isExclusiveClubRole(role)) return;
  const holder = await findClubRoleHolder(supabase, role);
  if (holder && holder.id !== options.allowMemberId) {
    throw new Error(
      `${holder.full_name} already holds the ${CLUB_ROLE_LABELS[role]} role — choose a different role.`,
    );
  }
}

/** True when a Postgres error is the one-person-role unique index firing. */
export function isExclusiveRoleConflict(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return error.code === "23505" && (error.message ?? "").includes(EXCLUSIVE_ROLE_INDEX);
}

/**
 * Turn a lost race on the unique index into a readable error. The pre-insert
 * check can pass and the insert still fail when two officers accept at the same
 * moment; this is the message for that case.
 */
export async function exclusiveRoleConflictError(
  supabase: SupabaseClient<Database>,
  role: ClubRole,
): Promise<Error> {
  const holder = await findClubRoleHolder(supabase, role);
  const label = CLUB_ROLE_LABELS[role];
  return new Error(
    holder
      ? `${holder.full_name} already holds the ${label} role — choose a different role.`
      : `The ${label} role was just taken — choose a different role.`,
  );
}

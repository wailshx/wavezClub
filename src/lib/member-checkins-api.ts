import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireSection } from "@/lib/admin-admins-api";

/**
 * Event check-in: one attendance sheet for the whole club, saved as officers
 * mark people present or absent at the door.
 *
 * The sheet is deliberately a single active event (migration `0028`): the page
 * loads it, autosaves changes, and the Reset button deletes every row — that
 * is what "start from 0" means. No row = not checked in yet.
 *
 * Every function is gated by the Members section, because the people being
 * marked come from `members` and the sheet is member data.
 */

export type CheckinStatus = "present" | "absent";

export type MemberCheckin = {
  member_id: string;
  status: CheckinStatus;
  updated_at: string;
};

type CheckinRow = {
  member_id: string;
  status: CheckinStatus;
  updated_at: string;
  updated_by: string | null;
};

type CheckinQuery<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}>;

/** `member_checkins` is newer than the generated Supabase types. */
const checkinsTable = (supabase: SupabaseClient<Database>) =>
  (
    supabase as unknown as {
      from: (name: string) => {
        select: (columns: string) => CheckinQuery<MemberCheckin[]>;
        upsert: (rows: CheckinRow[], options: { onConflict: string }) => CheckinQuery<null>;
        delete: () => {
          in: (column: string, values: string[]) => CheckinQuery<null>;
          neq: (column: string, value: string) => CheckinQuery<null>;
        };
      };
    }
  ).from("member_checkins");

/** PostgREST refuses an unfiltered DELETE through this helper, so use a filter. */
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const saveCheckinsSchema = z.object({
  entries: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        /** null clears the mark — the member goes back to "not checked in". */
        status: z.enum(["present", "absent"]).nullable(),
      }),
    )
    .max(5000),
});

export const listMemberCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "members");
    const { data, error } = await checkinsTable(supabase).select("member_id, status, updated_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as MemberCheckin[];
  });

/**
 * Apply the changes the page has queued: upsert every marked member and delete
 * the marks that were cleared. The client sends only what changed, so a save
 * during a busy door stays small even for a large member list.
 */
export const saveMemberCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { entries: { memberId: string; status: CheckinStatus | null }[] }) =>
    saveCheckinsSchema.parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = await requireSection(context, "members");
    const table = checkinsTable(supabase);
    const now = new Date().toISOString();

    const marked = data.entries.filter(
      (entry): entry is { memberId: string; status: CheckinStatus } => entry.status !== null,
    );
    const cleared = data.entries.filter((entry) => entry.status === null);

    if (marked.length > 0) {
      const { error } = await table.upsert(
        marked.map((entry) => ({
          member_id: entry.memberId,
          status: entry.status,
          updated_at: now,
          updated_by: context.userId,
        })),
        { onConflict: "member_id" },
      );
      if (error) throw new Error(error.message);
    }

    if (cleared.length > 0) {
      const { error } = await table.delete().in(
        "member_id",
        cleared.map((entry) => entry.memberId),
      );
      if (error) throw new Error(error.message);
    }

    return { saved: marked.length, cleared: cleared.length };
  });

/** Clear the whole sheet, ready for the next event. */
export const resetMemberCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireSection(context, "members");
    const { error } = await checkinsTable(supabase).delete().neq("member_id", ZERO_UUID);
    if (error) throw new Error(error.message);
    return true;
  });

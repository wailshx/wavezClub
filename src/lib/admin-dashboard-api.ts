// Dashboard analytics — server-only (src/lib, away from the **/server/** import gate).
//
// Primary path: one SECURITY DEFINER RPC (`get_dashboard_stats`, migration 0015)
// aggregates every chart/count in SQL, so the UI never fans out to row-level reads.
// The RPC is granted to service_role only, and is called with the service client
// AFTER `requireSection("dashboard")` validates the caller — PostgREST clients can't
// invoke it outside the app's admin gate.
//
// Fallback path: if the RPC hasn't been applied to the database yet (migrations are
// applied manually here), aggregate the same shape on the fly from the same tables so
// the app keeps working between commit and SQL-editor apply. Both paths return the
// identical DashboardStats shape.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection } from "@/lib/admin-admins-api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardCampaignFunnel = {
  id: string;
  title: string;
  kind: string;
  submitted: number;
  checked_in: number;
  pending: number;
  accepted: number;
  removed: number;
};

export type DashboardStats = {
  members: {
    total: number;
    blocked: number;
    created_this_month: number;
    created_last_month: number;
    by_month: { month: string; cumulative: number }[];
    by_level: { level: string; value: number }[];
    by_department: { department: string; value: number }[];
  };
  adminRequests: {
    pending_count: number;
    pending: { id: string; name: string; email: string; role: string; created_at: string }[];
    by_month: { month: string; count: number }[];
  };
  registrations: {
    open_campaigns: number;
    pending_total: number;
    acceptance_rate: number | null;
    campaigns: DashboardCampaignFunnel[];
    by_month: { month: string; submitted: number }[];
  };
  events: { by_month: { month: string; count: number }[]; published: number; drafts: number };
  admins: { active_total: number; total: number; by_role: { role: string; value: number }[] };
};

type SectionFlags = { members: boolean; events: boolean; registrations: boolean };

// ─── Loose wrappers (tables/return types absent from generated types) ────────

type ReadResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };
type LooseDb = { from(table: string): { select(columns: string): Promise<ReadResult> } };

type RpcClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

// ─── Empty section shapes (used for access-gated sections) ───────────────────

const EMPTY_MEMBERS = {
  total: 0,
  blocked: 0,
  created_this_month: 0,
  created_last_month: 0,
  by_month: [],
  by_level: [],
  by_department: [],
} satisfies DashboardStats["members"];

const EMPTY_REGISTRATIONS = {
  open_campaigns: 0,
  pending_total: 0,
  acceptance_rate: null,
  campaigns: [],
  by_month: [],
} satisfies DashboardStats["registrations"];

const EMPTY_EVENTS = { by_month: [], published: 0, drafts: 0 } satisfies DashboardStats["events"];

// ─── Fallback aggregation helpers (pre-migration path) ──────────────────────

function monthBuckets(count: number, now: Date) {
  const buckets: { pos: number; label: string }[] = [];
  for (let pos = 0; pos < count; pos += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - pos), 1);
    buckets.push({ pos, label: d.toLocaleString("en-GB", { month: "short", year: "2-digit" }) });
  }
  return buckets;
}

/** Bucket ISO date strings into `count` month slots ending with the current month. */
function monthlySeries(count: number, isoDates: string[]) {
  const now = new Date();
  const counts = new Array<number>(count).fill(0);
  for (const iso of isoDates) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    const pos = count - 1 - diff;
    if (pos >= 0 && pos < count) counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return monthBuckets(count, now).map((b) => ({ month: b.label, count: counts[b.pos] ?? 0 }));
}

/**
 * Pre-migration fallback: aggregate DashboardStats from raw table reads.
 * Only the sections the caller may actually see are read (mirrors the RPC gating).
 */
async function aggregateLocally(db: unknown, flags: SectionFlags, isOwner: boolean) {
  const rows = async (table: string, columns: string): Promise<Record<string, unknown>[]> => {
    const { data, error } = await (db as LooseDb).from(table).select(columns);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  const stats: DashboardStats = {
    members: EMPTY_MEMBERS,
    adminRequests: { pending_count: 0, pending: [], by_month: [] },
    registrations: EMPTY_REGISTRATIONS,
    events: EMPTY_EVENTS,
    admins: { active_total: 0, total: 0, by_role: [] },
  };

  if (flags.members) {
    // `blocked_until` only exists once migration 0003 is applied; keep working
    // without it (members are simply never "currently blocked" until then).
    const attempt = await (db as LooseDb)
      .from("members")
      .select("created_at, blocked_until, level, department");
    let memberRows: Record<string, unknown>[];
    if (attempt.error && /blocked_until/i.test(attempt.error.message)) {
      const retry = await (db as LooseDb).from("members").select("created_at, level, department");
      if (retry.error) throw new Error(retry.error.message);
      memberRows = retry.data ?? [];
    } else if (attempt.error) {
      throw new Error(attempt.error.message);
    } else {
      memberRows = attempt.data ?? [];
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    let blocked = 0;
    let createdThisMonth = 0;
    let createdLastMonth = 0;
    const createdAt: string[] = [];
    const levelCounts = new Map<string, number>();
    const depCounts = new Map<string, number>();

    for (const row of memberRows) {
      const iso = String(row["created_at"] ?? "");
      if (iso) {
        createdAt.push(iso);
        const t = new Date(iso).getTime();
        if (t >= thisMonthStart) createdThisMonth += 1;
        else if (t >= lastMonthStart) createdLastMonth += 1;
      }
      const until = String(row["blocked_until"] ?? "");
      if (until && new Date(until).getTime() > now.getTime()) blocked += 1;
      const level = String(row["level"] ?? "Unknown");
      levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
      const department = String(row["department"] ?? "Unknown");
      depCounts.set(department, (depCounts.get(department) ?? 0) + 1);
    }

    let cumulative = 0;
    stats.members = {
      total: memberRows.length,
      blocked,
      created_this_month: createdThisMonth,
      created_last_month: createdLastMonth,
      by_month: monthlySeries(6, createdAt).map((m) => ({
        month: m.month,
        cumulative: (cumulative += m.count),
      })),
      by_level: [...levelCounts.entries()]
        .map(([level, value]) => ({ level, value }))
        .sort((a, b) => a.level.localeCompare(b.level)),
      by_department: [...depCounts.entries()]
        .map(([department, value]) => ({ department, value }))
        .sort((a, b) => b.value - a.value || a.department.localeCompare(b.department)),
    };
  }

  if (isOwner) {
    const requestRows = await rows(
      "admin_requests",
      "id, first_name, last_name, email, department, status, created_at",
    );
    const pending = requestRows
      .filter((row) => row["status"] === "pending")
      .map((row) => ({
        id: String(row["id"] ?? ""),
        name:
          `${String(row["first_name"] ?? "")} ${String(row["last_name"] ?? "")}`.trim() ||
          "Anonymous",
        email: String(row["email"] ?? ""),
        role: String(row["department"] ?? "admin"),
        created_at: String(row["created_at"] ?? ""),
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 20);
    stats.adminRequests = {
      pending_count: pending.length,
      pending,
      by_month: monthlySeries(
        6,
        requestRows.map((row) => String(row["created_at"] ?? "")),
      ),
    };
  }

  if (flags.registrations) {
    const campaignRows = (await rows(
      "registration_campaigns",
      "id, title, kind, is_open, display_order, created_at",
    )) as unknown as {
      id: string;
      title: string;
      kind: string;
      is_open: boolean;
      display_order: number;
      created_at: string;
    }[];
    const registrationRows = (await rows(
      "registrations",
      "campaign_id, status, checked_in, created_at",
    )) as unknown as {
      campaign_id: string;
      status: string;
      checked_in: boolean;
      created_at: string;
    }[];

    let pendingTotal = 0;
    let acceptedTotal = 0;
    let removedTotal = 0;
    const funnel = new Map<string, DashboardCampaignFunnel>();
    for (const row of registrationRows) {
      const key = String(row["campaign_id"] ?? "");
      const cur = funnel.get(key) ?? {
        id: key,
        title: "",
        kind: "",
        submitted: 0,
        checked_in: 0,
        pending: 0,
        accepted: 0,
        removed: 0,
      };
      cur.submitted += 1;
      if (row["checked_in"] === true) cur.checked_in += 1;
      if (row["status"] === "pending") {
        pendingTotal += 1;
        cur.pending += 1;
      } else if (row["status"] === "accepted") {
        acceptedTotal += 1;
        cur.accepted += 1;
      } else if (row["status"] === "removed") {
        removedTotal += 1;
        cur.removed += 1;
      }
      funnel.set(key, cur);
    }

    const open = campaignRows
      .filter((campaign) => campaign.is_open)
      .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at))
      .slice(0, 6);

    stats.registrations = {
      open_campaigns: open.length,
      pending_total: pendingTotal,
      acceptance_rate:
        acceptedTotal + removedTotal === 0
          ? null
          : Math.round((acceptedTotal / (acceptedTotal + removedTotal)) * 1000) / 10,
      by_month: monthlySeries(
        6,
        registrationRows.map((row) => String(row["created_at"] ?? "")),
      ).map((m) => ({ month: m.month, submitted: m.count })),
      campaigns: open.map((campaign) => ({
        ...(funnel.get(campaign.id) ?? {
          submitted: 0,
          checked_in: 0,
          pending: 0,
          accepted: 0,
          removed: 0,
        }),
        id: campaign.id,
        title: campaign.title,
        kind: campaign.kind,
      })),
    };
  }

  if (flags.events) {
    // Every row is a submission announcement — there is no `kind` filter left
    // since the event/news types were retired (migration 0016).
    const postRows = await rows("posts", "event_date, created_at, published");
    let published = 0;
    let drafts = 0;
    const eventDates: string[] = [];
    for (const row of postRows) {
      if (row["published"] === true) published += 1;
      else drafts += 1;
      eventDates.push(String(row["event_date"] ?? row["created_at"] ?? ""));
    }
    stats.events = { by_month: monthlySeries(6, eventDates), published, drafts };
  }

  const roleRows = await rows("user_roles", "role, admin_role, disabled_at");
  let total = 0;
  let activeTotal = 0;
  const roleCounts = new Map<string, number>();
  for (const row of roleRows) {
    if (row["role"] !== "admin") continue;
    total += 1;
    if (row["disabled_at"]) continue;
    activeTotal += 1;
    const role = String(row["admin_role"] ?? "General");
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }
  stats.admins = {
    active_total: activeTotal,
    total,
    by_role: [...roleCounts.entries()]
      .map(([role, value]) => ({ role, value }))
      .sort((a, b) => b.value - a.value || a.role.localeCompare(b.role)),
  };

  return stats;
}

// ─── Server function ─────────────────────────────────────────────────────────

/** Everything the Dashboard needs in one round-trip (SQL-aggregated). */
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireSection(context, "dashboard");

    const flags: SectionFlags = {
      members: access.isOwner || access.sections.includes("members"),
      events: access.isOwner || access.sections.includes("events"),
      registrations: access.isOwner || access.sections.includes("registrations"),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc(
      "get_dashboard_stats",
      {
        p_members_allowed: flags.members,
        p_events_allowed: flags.events,
        p_registrations_allowed: flags.registrations,
        p_include_pending_requests: access.isOwner,
      },
    );

    if (error) {
      if (/could not find the function|function .* does not exist|not found/i.test(error.message)) {
        console.warn(
          "[dashboard] get_dashboard_stats RPC missing (migration 0015 not applied?) — aggregating locally",
        );
        return aggregateLocally(supabaseAdmin, flags, access.isOwner);
      }
      throw new Error(error.message);
    }

    return data as DashboardStats;
  });

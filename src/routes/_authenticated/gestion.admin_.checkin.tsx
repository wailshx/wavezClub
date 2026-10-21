import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, RotateCcw, Save, Search, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { getAdminSession } from "@/lib/admin-admins-api";
import { listMembers } from "@/lib/admin-api";
import { CLUB_ROLE_LABELS } from "@/lib/club";
import {
  listMemberCheckins,
  resetMemberCheckins,
  saveMemberCheckins,
  type CheckinStatus,
} from "@/lib/member-checkins-api";

/**
 * Event check-in for the whole club.
 *
 * The sheet is local-first while an officer works the door: marks update
 * immediately, and a debounced autosave writes the diff (plus an explicit Save
 * for peace of mind). Reset deletes the sheet and starts the next event at 0.
 * The server resolves and stores everything; this page never trusts the
 * browser for who is a member.
 */
export const Route = createFileRoute("/_authenticated/gestion/admin_/checkin")({
  head: () => ({
    meta: [{ title: "Members check-in — Wavez Club" }, { name: "robots", content: "noindex" }],
  }),
  component: MembersCheckinPage,
});

type StatusFilter = "all" | "present" | "absent" | "unmarked";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "unmarked", label: "Not checked in" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
];

const controlClass =
  "clay-sm rounded-2xl bg-background px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-brand";

const pillBase =
  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors";

function MembersCheckinPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [marks, setMarks] = useState<Record<string, CheckinStatus>>({});
  const [dirty, setDirty] = useState<Record<string, CheckinStatus | null>>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const seeded = useRef(false);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => getAdminSession(),
  });

  const isOwner = session?.isOwner ?? false;
  const isAdmin = isOwner || (session?.isAdmin ?? false);
  const canMembers = isOwner || (session?.sections.includes("members") ?? false);

  const membersQuery = useQuery({
    queryKey: ["members"],
    enabled: isAdmin && canMembers,
    queryFn: () => listMembers(),
    refetchInterval: 60_000,
  });
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  const checkinsQuery = useQuery({
    queryKey: ["member-checkins"],
    enabled: isAdmin && canMembers,
    queryFn: () => listMemberCheckins(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Seed once. The sheet is the source for this visit; a later refetch must not
  // wipe marks an officer just made.
  useEffect(() => {
    if (seeded.current || !checkinsQuery.data) return;
    seeded.current = true;
    setMarks(
      Object.fromEntries(checkinsQuery.data.map((row) => [row.member_id, row.status])) as Record<
        string,
        CheckinStatus
      >,
    );
  }, [checkinsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (entries: { memberId: string; status: CheckinStatus | null }[]) =>
      saveMemberCheckins({ data: { entries } }),
    onSuccess: (_result, entries) => {
      // Only clear the values that were actually sent; a click made while the
      // request was in flight stays queued for the next autosave.
      setDirty((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          if (next[entry.memberId] === entry.status) delete next[entry.memberId];
        }
        return next;
      });
      setLastSavedAt(Date.now());
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save the check-in sheet"),
  });

  const { mutate: saveNow, isPending: saving } = saveMutation;

  const dirtyEntries = useMemo(
    () => Object.entries(dirty).map(([memberId, status]) => ({ memberId, status })),
    [dirty],
  );

  const resetMutation = useMutation({
    mutationFn: () => resetMemberCheckins(),
    onSuccess: () => {
      setMarks({});
      setDirty({});
      setLastSavedAt(null);
      setResetOpen(false);
      queryClient.setQueryData(["member-checkins"], []);
      toast.success("Check-in cleared — starting from 0.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not reset the check-in sheet"),
  });

  // Debounced autosave. The explicit Save button flushes the same queue. A
  // reset in flight pauses it so a late write cannot repopulate the sheet.
  useEffect(() => {
    if (saving || resetMutation.isPending || dirtyEntries.length === 0) return;
    const timer = setTimeout(() => saveNow(dirtyEntries), 1000);
    return () => clearTimeout(timer);
  }, [dirtyEntries, saving, resetMutation.isPending, saveNow]);

  function toggleMark(memberId: string, status: CheckinStatus) {
    const next = marks[memberId] === status ? null : status;
    setMarks((prev) => {
      const copy = { ...prev };
      if (next) copy[memberId] = next;
      else delete copy[memberId];
      return copy;
    });
    setDirty((prev) => ({ ...prev, [memberId]: next }));
  }

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const member of members) {
      const status = marks[member.id];
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
    }
    return { present, absent, unmarked: members.length - present - absent };
  }, [members, marks]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((member) => {
        const status = marks[member.id];
        if (statusFilter === "present" && status !== "present") return false;
        if (statusFilter === "absent" && status !== "absent") return false;
        if (statusFilter === "unmarked" && status) return false;
        if (!term) return true;
        const role = member.club_role ? CLUB_ROLE_LABELS[member.club_role] : "";
        return (
          member.full_name.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term) ||
          member.department.toLowerCase().includes(term) ||
          role.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [members, marks, search, statusFilter]);

  const isDirty = dirtyEntries.length > 0;

  if (sessionLoading) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center">
        <p className="font-bold text-white">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center px-5">
        <div className="admin-glass max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto size-8 text-[#fcd34d]" />
          <h1 className="mt-3 font-display text-xl font-bold text-white">
            This page is for club officers
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
            Sign in with an admin account to check members in.
          </p>
          <Link
            to="/gestion"
            className="clay-sm mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!canMembers) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center px-5">
        <div className="admin-glass max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto size-8 text-[#fcd34d]" />
          <h1 className="mt-3 font-display text-xl font-bold text-white">
            You don&apos;t have access to members
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
            Ask the club owner to grant you the Members section in the Admins page.
          </p>
          <Link
            to="/gestion/admin"
            className="clay-sm mt-5 inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-[#94a3c8]"
          >
            Back to the console
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-theme min-h-screen">
      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8">
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/gestion/admin"
            search={{ tab: "members" }}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#94a3c8] transition-colors hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Members
          </Link>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
              Members · Event
            </p>
            <h1 className="font-display text-3xl font-bold text-white">Check-in</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[#94a3c8]">
              Mark who is here. Changes save automatically — the Save button writes them
              immediately. Reset clears the sheet and starts the next event from 0.
            </p>
          </div>
          <p className="text-xs font-bold text-[#94a3c8]">
            {saving
              ? "Saving…"
              : isDirty
                ? "Unsaved changes…"
                : lastSavedAt
                  ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "All changes saved"}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Present", value: counts.present, tone: "text-[#6ee7b7]" },
            { label: "Absent", value: counts.absent, tone: "text-[#fda4af]" },
            { label: "Not checked in", value: counts.unmarked, tone: "text-[#94a3c8]" },
            { label: "Total members", value: members.length, tone: "text-[#6fa0ff]" },
          ].map((stat) => (
            <div key={stat.label} className="admin-glass rounded-2xl p-4">
              <p className={`font-display text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
              <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#94a3c8]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members…"
              className={`${controlClass} w-60 pl-10 font-semibold`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className={controlClass}
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveNow(dirtyEntries)}
              disabled={!isDirty || saving}
              className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-4" />
              {saving ? "Saving…" : "Save check-in"}
            </button>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              disabled={saving || resetMutation.isPending || members.length === 0}
              className="clay-sm flex items-center gap-2 rounded-2xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 px-4 py-2.5 text-sm font-bold text-[#fda4af] transition-colors hover:bg-[#f43f5e]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="size-4" />
              Reset
            </button>
          </div>
        </div>

        {(checkinsQuery.error || membersQuery.error) && (
          <div className="mt-4 rounded-2xl border border-[#fcd34d]/25 bg-[#fcd34d]/10 px-4 py-3 text-sm font-semibold text-[#fcd34d]">
            Could not load the check-in sheet:{" "}
            {(checkinsQuery.error ?? membersQuery.error)?.message}. If migration{" "}
            <span className="font-mono text-xs">0028_member_checkins</span> has not been applied
            yet, run it in the Supabase SQL editor and reload this page.
          </div>
        )}

        <div className="admin-glass mt-4 overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Level / Department</th>
                <th className="px-5 py-3">Club role</th>
                <th className="px-5 py-3">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {membersQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center font-semibold text-[#94a3c8]">
                    Loading members…
                  </td>
                </tr>
              )}
              {!membersQuery.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center font-semibold text-[#94a3c8]">
                    {members.length === 0
                      ? "No members yet — add members first."
                      : "No members match this filter."}
                  </td>
                </tr>
              )}
              {filtered.map((member) => {
                const status = marks[member.id];
                return (
                  <tr key={member.id} className="border-t border-white/5">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{member.full_name}</p>
                      <p className="text-xs font-semibold text-[#94a3c8]">{member.email}</p>
                    </td>
                    <td className="px-5 py-3 text-[#c7d2fe]">
                      <span className="font-bold">{member.level}</span>
                      <span className="text-[#94a3c8]"> · {member.department}</span>
                    </td>
                    <td className="px-5 py-3 text-[#94a3c8]">
                      {member.club_role ? CLUB_ROLE_LABELS[member.club_role] : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-pressed={status === "present"}
                          onClick={() => toggleMark(member.id, "present")}
                          className={`${pillBase} ${
                            status === "present"
                              ? "border-[#34d399]/50 bg-[#34d399]/15 text-[#6ee7b7]"
                              : "border-white/10 bg-white/5 text-[#94a3c8] hover:text-white"
                          }`}
                        >
                          <UserCheck className="size-4" />
                          Present
                        </button>
                        <button
                          type="button"
                          aria-pressed={status === "absent"}
                          onClick={() => toggleMark(member.id, "absent")}
                          className={`${pillBase} ${
                            status === "absent"
                              ? "border-[#f43f5e]/50 bg-[#f43f5e]/15 text-[#fda4af]"
                              : "border-white/10 bg-white/5 text-[#94a3c8] hover:text-white"
                          }`}
                        >
                          <UserX className="size-4" />
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs font-semibold text-[#94a3c8]">
          Present and Absent toggle on and off — clicking the active state again leaves the member
          as not checked in. That member is neither counted present nor absent.
        </p>
      </main>

      {resetOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm">
          <div className="admin-glass-strong w-full max-w-md rounded-3xl p-7">
            <h2 className="font-display text-xl font-bold text-white">Reset check-in</h2>
            <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
              Clear the sheet for all {members.length} members and start from 0? Present and absent
              marks will be deleted. This can&apos;t be undone.
            </p>
            <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-[#c7d2fe]">
              {counts.present} present · {counts.absent} absent · {counts.unmarked} not checked in
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending || saving}
                className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
              >
                {resetMutation.isPending ? "Resetting…" : "Reset to 0"}
              </button>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

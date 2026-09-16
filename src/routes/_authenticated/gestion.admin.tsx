import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, LEVELS, SPECIALITIES, initials, type Level } from "@/lib/club";
import {
  getAdminStatus,
  listMembers,
  updateMember,
  deleteMember,
  blockMember as blockMemberApi,
  unblockMember as unblockMemberApi,
  listPosts,
  savePost as savePostApi,
  deletePost,
  listEmailDrafts,
  saveEmailDraft as saveEmailDraftApi,
  deleteEmailDraft,
  sendEmail as sendEmailApi,
} from "@/lib/admin-api";

export const Route = createFileRoute("/_authenticated/gestion/admin")({
  head: () => ({
    meta: [
      { title: "Member console — Wavez Club" },
      { name: "description", content: "Manage Wavez Club members, levels and departments." },
      { property: "og:title", content: "Member console — Wavez Club" },
      { property: "og:description", content: "Wavez Club officers manage member records." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Member = {
  id: string;
  full_name: string;
  age: number;
  email: string;
  phone: string;
  speciality: string;
  level: Level;
  department: string;
  status: string;
  admin_role: string | null;
  blocked_until: string | null;
  created_at: string;
};

const BLOCK_PRESETS = {
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
} as const;

type BlockOption = keyof typeof BLOCK_PRESETS | "custom";

const LEADERSHIP_ORDER = [
  "president",
  "vice_president",
  "media_leader",
  "vice_media_leader",
  "hr_leader",
  "vice_hr_leader",
];

const ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  media_leader: "Media Leader",
  vice_media_leader: "Vice Media Leader",
  hr_leader: "HR Leader",
  vice_hr_leader: "Vice HR Leader",
};

function leadershipRank(role: string | null) {
  const idx = LEADERSHIP_ORDER.indexOf(role ?? "");
  return idx === -1 ? LEADERSHIP_ORDER.length : idx;
}

function isBlocked(member: Pick<Member, "blocked_until">) {
  return !!member.blocked_until && new Date(member.blocked_until).getTime() > Date.now();
}

type Post = {
  id: string;
  kind: "event" | "news";
  title: string;
  body: string;
  location: string | null;
  event_date: string | null;
  published: boolean;
  created_at: string;
};

const blankPost: Post = {
  id: "",
  kind: "event",
  title: "",
  body: "",
  location: "",
  event_date: null,
  published: true,
  created_at: "",
};

const levelTint: Record<Level, string> = {
  L1: "bg-lilac/30 text-lilac-foreground",
  L2: "bg-blossom/25 text-blossom-foreground",
  L3: "bg-lemon/40 text-lemon-foreground",
  M1: "bg-mint/30 text-mint-foreground",
  M2: "bg-brand/20 text-brand-deep",
};

const controlClass =
  "clay-sm rounded-2xl bg-background px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-brand";
const fieldClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState("all");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [postDraft, setPostDraft] = useState<Post | null>(null);
  const [tab, setTab] = useState<"dashboard" | "members" | "events" | "email">("dashboard");
  const [blockTarget, setBlockTarget] = useState<Member | null>(null);
  const [blockOption, setBlockOption] = useState<BlockOption>("1w");
  const [customUntil, setCustomUntil] = useState("");
  const [emailView, setEmailView] = useState<"recipients" | "compose">("recipients");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTemplate, setEmailTemplate] = useState("custom");
  const [attachmentName, setAttachmentName] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => getAdminStatus(),
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    enabled: isAdmin === true,
    queryFn: () => listMembers(),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => deleteMember({ data: id }),
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not remove this member"),
  });

  const saveMember = useMutation({
    mutationFn: (member: Member) => updateMember({ data: member }),
    onSuccess: () => {
      toast.success("Member updated");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not save changes"),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-posts"],
    enabled: isAdmin === true,
    queryFn: () => listPosts(),
  });

  const savePost = useMutation({
    mutationFn: (post: Post) => savePostApi({ data: post }),
    onSuccess: () => {
      toast.success("Post saved");
      setPostDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
    },
    onError: () => toast.error("Could not save this post"),
  });

  const removePost = useMutation({
    mutationFn: (id: string) => deletePost({ data: id }),
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["public-posts"] });
    },
    onError: () => toast.error("Could not delete this post"),
  });

  const blockMember = useMutation({
    mutationFn: (data: { id: string; until: string }) => blockMemberApi({ data }),
    onSuccess: () => {
      toast.success("Member blocked");
      setBlockTarget(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not block this member"),
  });

  const unblockMember = useMutation({
    mutationFn: (id: string) => unblockMemberApi({ data: id }),
    onSuccess: () => {
      toast.success("Member unblocked");
      setBlockTarget(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: () => toast.error("Could not unblock this member"),
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["email-drafts"],
    enabled: isAdmin === true,
    queryFn: () => listEmailDrafts(),
  });

  const saveDraft = useMutation({
    mutationFn: (payload: {
      id: string | null;
      subject: string;
      body: string;
      recipientIds: string[];
    }) => saveEmailDraftApi({ data: payload }),
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
    },
    onError: () => toast.error("Could not save this draft"),
  });

  const removeDraft = useMutation({
    mutationFn: (id: string) => deleteEmailDraft({ data: id }),
    onSuccess: () => {
      toast.success("Draft deleted");
      queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
    },
    onError: () => toast.error("Could not delete this draft"),
  });

  const sendEmail = useMutation({
    mutationFn: (payload: { recipients: string[]; subject: string; body: string }) =>
      sendEmailApi({ data: payload }),
    onSuccess: () => {
      toast.success("Email sent (stubbed)");
      setEmailView("recipients");
      setSelectedIds(new Set());
      setEmailSubject("");
      setEmailBody("");
      setEmailTemplate("custom");
      setAttachmentName("");
      setSelectedDraftId(null);
    },
    onError: () => toast.error("Could not send this email"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((member) => {
        if (level !== "all" && member.level !== level) return false;
        if (department !== "all" && member.department !== department) return false;
        if (!term) return true;
        return (
          member.full_name.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term) ||
          member.phone.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const rankDiff = leadershipRank(a.admin_role) - leadershipRank(b.admin_role);
        if (rankDiff !== 0) return rankDiff;
        const nameDiff = a.full_name.localeCompare(b.full_name);
        if (nameDiff !== 0) return nameDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [members, level, department, search]);

  const now = useMemo(() => Date.now(), []);
  const statusBreakdown = useMemo(() => {
    let active = 0;
    let pending = 0;
    let blocked = 0;
    for (const member of members) {
      if (member.blocked_until && new Date(member.blocked_until).getTime() > now) {
        blocked += 1;
      } else if (member.status === "pending") {
        pending += 1;
      } else {
        active += 1;
      }
    }
    return { active, pending, blocked };
  }, [members, now]);

  const levelDist = useMemo(
    () =>
      LEVELS.map((lvl) => ({
        name: lvl,
        value: members.filter((m) => m.level === lvl).length,
      })),
    [members],
  );

  const departmentDist = useMemo(
    () =>
      DEPARTMENTS.map((dep) => ({
        name: dep,
        value: members.filter((m) => m.department === dep).length,
      })),
    [members],
  );

  const eventTrend = useMemo(() => {
    const labels = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      return d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
    });
    const buckets = labels.map(() => 0);
    const nowT = new Date();
    for (const post of posts) {
      if (post.kind !== "event") continue;
      const ts = post.event_date ? new Date(post.event_date) : new Date(post.created_at);
      const monthStart = new Date(ts.getFullYear(), ts.getMonth(), 1);
      const diffMonths =
        (nowT.getFullYear() - ts.getFullYear()) * 12 + (nowT.getMonth() - ts.getMonth());
      if (diffMonths < 0 || diffMonths > 5) continue;
      const idx = 5 - diffMonths;
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    return labels.map((label, i) => ({ month: label, count: buckets[i] }));
  }, [posts]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/gestion", replace: true });
  }

  function exportToExcel(rows: Member[]) {
    if (rows.length === 0) {
      toast.error("No members to export");
      return;
    }
    const aoa = [
      ["Name", "Level", "Department", "Speciality", "Status", "Blocked Until"],
      ...rows.map((m) => [
        m.full_name,
        m.level,
        m.department,
        m.speciality,
        isBlocked(m) ? "blocked" : m.status,
        m.blocked_until ? new Date(m.blocked_until).toLocaleDateString("en-GB") : "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 22 }, { wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `wavez-members-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} members exported`);
  }

  if (roleLoading) {
    return <div className="grid min-h-screen place-items-center font-bold">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <div className="clay-lg max-w-md rounded-3xl bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Not a club officer</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            This account doesn't have admin access to the member list.
          </p>
          <button
            onClick={signOut}
            className="clay-sm mt-6 rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="clay-lg rounded-3xl bg-card p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
                Admin dashboard
              </p>
              <h1 className="font-display text-2xl font-bold">Member management</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="clay-sm rounded-2xl bg-background px-5 py-2.5 text-sm font-bold"
              >
                View site
              </Link>
              <button
                onClick={signOut}
                className="clay-sm rounded-2xl bg-brand-deep px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setTab("dashboard")}
              className={
                tab === "dashboard"
                  ? "clay-sm rounded-xl bg-brand px-4 py-2 text-sm font-bold text-primary-foreground"
                  : "clay-sm rounded-2xl bg-background px-4 py-2 text-sm font-bold"
              }
            >
              Dashboard
            </button>
            <button
              onClick={() => setTab("members")}
              className={
                tab === "members"
                  ? "clay-sm rounded-xl bg-brand px-4 py-2 text-sm font-bold text-primary-foreground"
                  : "clay-sm rounded-2xl bg-background px-4 py-2 text-sm font-bold"
              }
            >
              Members
            </button>
            <button
              onClick={() => setTab("events")}
              className={
                tab === "events"
                  ? "clay-sm rounded-xl bg-brand px-4 py-2 text-sm font-bold text-primary-foreground"
                  : "clay-sm rounded-2xl bg-background px-4 py-2 text-sm font-bold"
              }
            >
              Events
            </button>
            <button
              onClick={() => setTab("email")}
              className={
                tab === "email"
                  ? "clay-sm rounded-xl bg-brand px-4 py-2 text-sm font-bold text-primary-foreground"
                  : "clay-sm rounded-2xl bg-background px-4 py-2 text-sm font-bold"
              }
            >
              Email
            </button>
          </div>

          {tab === "dashboard" && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="font-display text-2xl font-bold text-brand-deep">
                    {members.length}
                  </p>
                  <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    Total members
                  </p>
                </div>
                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="font-display text-2xl font-bold">{statusBreakdown.active}</p>
                  <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    Active
                  </p>
                </div>
                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="font-display text-2xl font-bold">{statusBreakdown.pending}</p>
                  <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    Pending
                  </p>
                </div>
                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="font-display text-2xl font-bold">{statusBreakdown.blocked}</p>
                  <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    Blocked
                  </p>
                </div>
              </div>

              {members.length === 0 && (
                <p className="rounded-2xl bg-background px-4 py-6 text-center font-semibold text-muted-foreground">
                  No members yet — add members from the Members tab to see analytics.
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                    Members by level
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={levelDist}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {levelDist.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={["#6366f1", "#a855f7", "#f59e0b", "#10b981", "#3b82f6"][i % 5]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="clay-sm rounded-2xl bg-background p-4">
                  <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                    Members by department
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentDist}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis allowDecimals={false} width={28} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="clay-sm rounded-2xl bg-background p-4">
                <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                  Events — last 6 months
                </p>
                {eventTrend.every((e) => e.count === 0) ? (
                  <p className="py-10 text-center font-semibold text-muted-foreground">
                    No events yet.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eventTrend}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} width={28} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {(tab === "members" || tab === "events") && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="clay-sm rounded-2xl bg-background p-4">
                <p className="font-display text-2xl font-bold text-brand-deep">{members.length}</p>
                <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                  Total
                </p>
              </div>
              {LEVELS.map((lvl) => (
                <div key={lvl} className="clay-sm rounded-2xl bg-background p-4">
                  <p className="font-display text-2xl font-bold">
                    {members.filter((m) => m.level === lvl).length}
                  </p>
                  <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    {lvl}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === "members" && (
            <>
              <div className="mt-6 flex flex-wrap gap-3">
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className={controlClass}
                >
                  <option value="all">All levels</option>
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={controlClass}
                >
                  <option value="all">All departments</option>
                  {DEPARTMENTS.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members…"
                  className={`${controlClass} w-56 font-semibold`}
                />
                <button
                  onClick={() => exportToExcel(filtered)}
                  disabled={filtered.length === 0}
                  className="clay-sm ml-auto rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  Export .xlsx
                </button>
              </div>

              <div className="clay-sm mt-6 overflow-x-auto rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background text-left text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      <th className="px-5 py-3">Member</th>
                      <th className="px-5 py-3">Level</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Speciality</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {isLoading && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-8 text-center font-semibold text-muted-foreground"
                        >
                          Loading…
                        </td>
                      </tr>
                    )}
                    {filtered.length === 0 && !isLoading && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-8 text-center font-semibold text-muted-foreground"
                        >
                          No matching members found.
                        </td>
                      </tr>
                    )}
                    {filtered.map((member) => (
                      <tr key={member.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-bold">{member.full_name}</p>
                          {member.admin_role && (
                            <p className="text-[11px] font-extrabold tracking-wide uppercase text-brand">
                              {ROLE_LABELS[member.admin_role] ?? member.admin_role}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {member.phone} — {member.email}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 font-semibold">{member.level}</td>
                        <td className="px-5 py-3.5 font-semibold">{member.department}</td>
                        <td className="px-5 py-3.5 font-semibold">{member.speciality}</td>
                        <td className="px-5 py-3.5">
                          {isBlocked(member) ? (
                            <div>
                              <span className="inline-block rounded-full bg-blossom/25 px-3 py-1 text-[11px] font-extrabold uppercase text-blossom-foreground">
                                Blocked
                              </span>
                              <p className="mt-1 text-[11px] font-bold text-blossom-foreground">
                                until{" "}
                                {new Date(member.blocked_until as string).toLocaleDateString(
                                  "en-GB",
                                )}
                              </p>
                            </div>
                          ) : (
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-[11px] font-extrabold uppercase ${
                                member.status === "active"
                                  ? "bg-mint/25 text-mint-foreground"
                                  : "bg-lemon/30 text-lemon-foreground"
                              }`}
                            >
                              {member.status}
                            </span>
                          )}
                        </td>
                        <td className="space-x-2 px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setBlockTarget(member);
                              setBlockOption("1w");
                              setCustomUntil("");
                            }}
                            className={`clay-sm rounded-lg px-3 py-1.5 text-xs font-bold ${
                              isBlocked(member)
                                ? "bg-mint/30 text-mint-foreground"
                                : "bg-blossom/25 text-blossom-foreground"
                            }`}
                          >
                            {isBlocked(member) ? "Unblock" : "Block"}
                          </button>
                          <button
                            onClick={() => setEditing(member)}
                            className="clay-sm rounded-lg bg-lemon/40 px-3 py-1.5 text-xs font-bold text-lemon-foreground"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${member.full_name} from the club?`)) {
                                removeMember.mutate(member.id);
                              }
                            }}
                            className="clay-sm rounded-lg bg-blossom/25 px-3 py-1.5 text-xs font-bold text-blossom-foreground"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {tab === "email" && (
          <div className="mt-6">
            {emailView === "recipients" ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-brand uppercase">
                      Bulk email
                    </p>
                    <h2 className="font-display text-2xl font-bold">Email members</h2>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedIds.size === 0) {
                        toast.error("Select at least one member");
                        return;
                      }
                      setEmailView("compose");
                    }}
                    disabled={selectedIds.size === 0}
                    className="clay-sm rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    Compose email
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {selectedIds.size} of {members.length} selected
                </p>

                <label className="clay-sm mt-4 flex cursor-pointer items-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === members.length && members.length > 0}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? new Set(members.map((m) => m.id)) : new Set(),
                      )
                    }
                  />
                  Select all members
                </label>

                <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl bg-background p-3">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-card"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(member.id);
                          else next.delete(member.id);
                          setSelectedIds(next);
                        }}
                      />
                      <span className="text-sm font-bold">{member.full_name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{member.email}</span>
                    </label>
                  ))}
                </div>

                {drafts.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Saved drafts
                    </h3>
                    <div className="mt-2 grid gap-2">
                      {drafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="clay-sm flex items-center gap-3 rounded-2xl bg-background px-4 py-3"
                        >
                          <button
                            onClick={() => {
                              setEmailSubject(draft.subject);
                              setEmailBody(draft.body);
                              setSelectedIds(new Set(draft.recipient_ids));
                              setEmailTemplate("custom");
                              setSelectedDraftId(draft.id);
                              setEmailView("compose");
                            }}
                            className="flex-1 text-left"
                          >
                            <p className="font-bold">{draft.subject || "(no subject)"}</p>
                            <p className="text-xs text-muted-foreground">
                              {draft.recipient_ids.length} recipients ·{" "}
                              {new Date(draft.created_at).toLocaleDateString("en-GB")}
                            </p>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this draft?")) removeDraft.mutate(draft.id);
                            }}
                            className="clay-sm rounded-lg bg-blossom/20 px-3 py-1.5 text-xs font-bold text-blossom-foreground"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-extrabold tracking-wide text-brand uppercase">
                    Compose email
                  </p>
                  <button
                    onClick={() => setEmailView("recipients")}
                    className="clay-sm rounded-2xl bg-background px-4 py-2 text-sm font-bold"
                  >
                    ← Back to recipients
                  </button>
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Template
                    </label>
                    <select
                      className={fieldClass}
                      value={emailTemplate}
                      onChange={(e) => {
                        const tpl = e.target.value;
                        setEmailTemplate(tpl);
                        if (tpl === "general-meeting") {
                          setEmailSubject("Club meeting — this week");
                          setEmailBody(
                            "Hi {name},\n\nThis is a reminder that our club meeting takes place this week.\n\nSee you there,\nWavez Club",
                          );
                        } else if (tpl === "welcome") {
                          setEmailSubject("Welcome to Wavez Club");
                          setEmailBody(
                            "Hi {name},\n\nWelcome aboard! Here's everything you need to know about your first week with Wavez Club.\n\nBest,\nWavez Club",
                          );
                        }
                      }}
                    >
                      <option value="custom">Custom</option>
                      <option value="general-meeting">Meeting reminder</option>
                      <option value="welcome">Welcome message</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Subject
                    </label>
                    <input
                      className={fieldClass}
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Message
                    </label>
                    <textarea
                      rows={6}
                      className={fieldClass}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Attachment
                    </label>
                    <input
                      type="file"
                      className={fieldClass}
                      onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
                    />
                    {attachmentName && (
                      <p className="mt-1 text-xs font-bold text-brand">
                        Attached: {attachmentName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        const recipients = members
                          .filter((m) => selectedIds.has(m.id))
                          .map((m) => m.email);
                        if (recipients.length === 0) {
                          toast.error("No recipients selected");
                          return;
                        }
                        sendEmail.mutate({ recipients, subject: emailSubject, body: emailBody });
                      }}
                      disabled={sendEmail.isPending || !emailSubject.trim() || !emailBody.trim()}
                      className="clay-md rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground disabled:opacity-60"
                    >
                      {sendEmail.isPending ? "Sending…" : "Send email"}
                    </button>
                    <button
                      onClick={() =>
                        saveDraft.mutate({
                          id: selectedDraftId,
                          subject: emailSubject,
                          body: emailBody,
                          recipientIds: members
                            .filter((m) => selectedIds.has(m.id))
                            .map((m) => m.id),
                        })
                      }
                      disabled={saveDraft.isPending || (!emailSubject.trim() && !emailBody.trim())}
                      className="clay-sm rounded-2xl bg-lemon/40 px-6 py-3 font-bold text-lemon-foreground disabled:opacity-60"
                    >
                      {saveDraft.isPending ? "Saving…" : "Save draft"}
                    </button>
                    <button
                      onClick={() => setEmailView("recipients")}
                      className="clay-sm rounded-2xl bg-background px-6 py-3 font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="clay-lg mt-8 rounded-3xl bg-card p-8 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold tracking-wide text-brand uppercase">
                  Home page content
                </p>
                <h2 className="font-display text-2xl font-bold">Events &amp; news</h2>
              </div>
              <button
                onClick={() => setPostDraft({ ...blankPost })}
                className="clay-sm rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                New post
              </button>
            </div>

            {postDraft && (
              <form
                className="clay-sm mt-6 grid gap-4 rounded-2xl bg-background p-5 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  savePost.mutate(postDraft);
                }}
              >
                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Title
                  </label>
                  <input
                    required
                    className={fieldClass}
                    value={postDraft.title}
                    onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Type
                  </label>
                  <select
                    className={fieldClass}
                    value={postDraft.kind}
                    onChange={(e) =>
                      setPostDraft({ ...postDraft, kind: e.target.value as Post["kind"] })
                    }
                  >
                    <option value="event">event</option>
                    <option value="news">news</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Date &amp; time
                  </label>
                  <input
                    type="datetime-local"
                    className={fieldClass}
                    value={postDraft.event_date ? postDraft.event_date.slice(0, 16) : ""}
                    onChange={(e) =>
                      setPostDraft({ ...postDraft, event_date: e.target.value || null })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Place
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="Amphi 3, Faculty of Electrical Engineering"
                    value={postDraft.location ?? ""}
                    onChange={(e) => setPostDraft({ ...postDraft, location: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Details
                  </label>
                  <textarea
                    rows={4}
                    className={fieldClass}
                    value={postDraft.body}
                    onChange={(e) => setPostDraft({ ...postDraft, body: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={postDraft.published}
                    onChange={(e) => setPostDraft({ ...postDraft, published: e.target.checked })}
                  />
                  Visible on the home page
                </label>
                <div className="flex gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savePost.isPending}
                    className="clay-md rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground disabled:opacity-70"
                  >
                    Save post
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostDraft(null)}
                    className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {posts.length === 0 && (
                <p className="font-semibold text-muted-foreground">
                  No events or news yet — create your first post.
                </p>
              )}
              {posts.map((post) => (
                <div key={post.id} className="clay-sm rounded-2xl bg-background p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand/15 px-3 py-1 text-[11px] font-extrabold text-brand uppercase">
                      {post.kind}
                    </span>
                    {!post.published && (
                      <span className="rounded-full bg-blossom/20 px-3 py-1 text-[11px] font-extrabold text-blossom-foreground uppercase">
                        hidden
                      </span>
                    )}
                    {post.event_date && (
                      <span className="text-xs font-bold text-muted-foreground">
                        {new Date(post.event_date).toLocaleString("en-GB")}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-display text-lg font-bold">{post.title}</p>
                  {post.location && (
                    <p className="text-xs font-bold text-brand">📍 {post.location}</p>
                  )}
                  <p className="mt-2 line-clamp-3 text-sm font-semibold text-muted-foreground">
                    {post.body}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setPostDraft(post)}
                      className="clay-sm rounded-lg bg-mint/25 px-3 py-1.5 text-xs font-bold text-mint-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${post.title}"?`)) removePost.mutate(post.id);
                      }}
                      className="clay-sm rounded-lg bg-blossom/20 px-3 py-1.5 text-xs font-bold text-blossom-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-5 py-10">
          <div className="clay-lg w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-7">
            <h2 className="font-display text-xl font-bold">Edit member</h2>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMember.mutate(editing);
              }}
            >
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Name
                </label>
                <input
                  className={fieldClass}
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Age
                </label>
                <input
                  type="number"
                  className={fieldClass}
                  value={editing.age}
                  onChange={(e) => setEditing({ ...editing, age: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Phone
                </label>
                <input
                  className={fieldClass}
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Email
                </label>
                <input
                  type="email"
                  className={fieldClass}
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Level
                </label>
                <select
                  className={fieldClass}
                  value={editing.level}
                  onChange={(e) => setEditing({ ...editing, level: e.target.value as Level })}
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Status
                </label>
                <select
                  className={fieldClass}
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Speciality
                </label>
                <select
                  className={fieldClass}
                  value={editing.speciality}
                  onChange={(e) => setEditing({ ...editing, speciality: e.target.value })}
                >
                  {SPECIALITIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Department
                </label>
                <select
                  className={fieldClass}
                  value={editing.department}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                >
                  {DEPARTMENTS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saveMember.isPending}
                  className="clay-md rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground disabled:opacity-70"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="clay-sm rounded-2xl bg-background px-6 py-3 font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {blockTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-5 py-10">
          <div className="clay-lg w-full max-w-md overflow-y-auto rounded-3xl bg-card p-7">
            {isBlocked(blockTarget) ? (
              <>
                <h2 className="font-display text-xl font-bold">Unblock member</h2>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {blockTarget.full_name} is currently blocked until{" "}
                  <span className="text-blossom-foreground">
                    {new Date(blockTarget.blocked_until as string).toLocaleString("en-GB")}
                  </span>
                  . They will be able to join the club again as soon as you unblock them.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => unblockMember.mutate(blockTarget.id)}
                    disabled={unblockMember.isPending}
                    className="clay-md rounded-2xl bg-mint px-6 py-3 font-bold text-mint-foreground disabled:opacity-70"
                  >
                    Unblock now
                  </button>
                  <button
                    onClick={() => setBlockTarget(null)}
                    className="clay-sm rounded-2xl bg-background px-6 py-3 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold">Block member</h2>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  Blocking {blockTarget.full_name} will mark them as blocked in the club until the
                  date you choose. This won't delete any of their data.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(["1w", "2w", "1m", "3m"] as const).map((opt) => (
                    <label
                      key={opt}
                      className="clay-sm flex cursor-pointer items-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm font-bold"
                    >
                      <input
                        type="radio"
                        name="block-duration"
                        checked={blockOption === opt}
                        onChange={() => setBlockOption(opt)}
                      />
                      {opt === "1w"
                        ? "1 week"
                        : opt === "2w"
                          ? "2 weeks"
                          : opt === "1m"
                            ? "1 month"
                            : "3 months"}
                    </label>
                  ))}
                  <label className="clay-sm flex cursor-pointer items-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="block-duration"
                      checked={blockOption === "custom"}
                      onChange={() => setBlockOption("custom")}
                    />
                    Custom date
                  </label>
                  {blockOption === "custom" && (
                    <input
                      type="datetime-local"
                      value={customUntil}
                      onChange={(e) => setCustomUntil(e.target.value)}
                      className={fieldClass}
                    />
                  )}
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      const todayMs = Date.now();
                      const ms = blockOption === "custom" ? null : BLOCK_PRESETS[blockOption];
                      const until = ms
                        ? new Date(todayMs + ms).toISOString()
                        : new Date(customUntil).toISOString();
                      blockMember.mutate({ id: blockTarget.id, until });
                    }}
                    disabled={blockMember.isPending || (blockOption === "custom" && !customUntil)}
                    className="clay-md rounded-2xl bg-blossom px-6 py-3 font-bold text-blossom-foreground disabled:opacity-70"
                  >
                    {blockMember.isPending ? "Blocking…" : "Block member"}
                  </button>
                  <button
                    onClick={() => setBlockTarget(null)}
                    className="clay-sm rounded-2xl bg-background px-6 py-3 font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

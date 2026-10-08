import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  type LucideIcon,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  Ban,
  CalendarDays,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  FilePlus2,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Paperclip,
  Pencil,
  Pin,
  Save,
  Search,
  Send,
  Settings2,
  Shield,
  Trash2,
  User,
  UserCheck,
  Users,
  Users2,
  Waves,
  X,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip as ShadTooltip,
  TooltipContent as ShadTooltipContent,
  TooltipProvider as ShadTooltipProvider,
  TooltipTrigger as ShadTooltipTrigger,
} from "@/components/ui/tooltip";
import logo from "@/assets/wavez-logo.png";
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
  listLeaders,
  saveLeader as saveLeaderApi,
  deleteLeader,
  saveLeaderOrder,
  type AdminLeader,
  listTeam,
  saveTeamMember as saveTeamMemberApi,
  deleteTeamMember as deleteTeamMemberApi,
  saveTeamOrder as saveTeamOrderApi,
  getMemberDocumentUrl,
  type AdminTeamMember,
  type MemberDocumentKey,
  type AdminPost,
  type AdminPostCampaign,
} from "@/lib/admin-api";
import { MAX_LEADER_DESCRIPTION } from "@/lib/leaders";
import {
  listRegistrationCampaigns,
  type AdminCampaign,
  type AdminRegistration,
} from "@/lib/admin-registrations-api";
import { CustomQuestionsEditor } from "@/components/admin-submissions";
import {
  ANNOUNCEMENT_KIND,
  CAMPAIGN_KIND_FOR_SUBMISSION,
  SUBMISSION_TYPES,
  SUBMISSION_TYPE_HINT,
  SUBMISSION_TYPE_KIND_LABEL,
  SUBMISSION_TYPE_LABEL,
  type SubmissionType,
} from "@/lib/announcements";
import { isValidLinkedinUrl, TEAM_CATEGORIES, teamCategoryLabel } from "@/lib/team";
import { SubmissionAnnouncementCard } from "@/components/submission-announcement-card";
import {
  ADMIN_SECTIONS,
  adminSectionLabel,
  getAdminSession,
  listAdmins,
  listAdminRequests,
  decideAdminRequest,
  deleteAdmin,
  deleteAdminRequest,
  resendAdminInvite,
  setAdminDisabled,
  setAdminSectionAllowed,
  updateAdminProfile,
  type AdminRow,
  type AdminSection,
} from "@/lib/admin-admins-api";
import {
  getDashboardStats,
  type DashboardCampaignFunnel,
  type DashboardStats,
} from "@/lib/admin-dashboard-api";

/**
 * The owner's address is a public build-time value (`VITE_OWNER_EMAIL`), the
 * same one the server compares against, so the console can recognise the owner
 * row and avoid rendering actions the server would reject.
 */
const OWNER_EMAIL = (
  (import.meta.env["VITE_OWNER_EMAIL"] as string | undefined) ?? ""
).toLowerCase();

const ADMIN_TAB_KEYS = [
  "dashboard",
  "members",
  "events",
  "email",
  "leaders",
  "team",
  "registrations",
  "admins",
] as const;
type AdminTab = (typeof ADMIN_TAB_KEYS)[number];

export const Route = createFileRoute("/_authenticated/gestion/admin")({
  // The console used to be one page you could not link into. The submissions
  // page sends officers back here, and landing on the Dashboard would hide
  // where they just were.
  validateSearch: (search: Record<string, unknown>) => {
    // Returning `{}` rather than `{ tab: undefined }` keeps the parameter
    // optional, so every existing <Link to="/gestion/admin"> still compiles.
    const tab = search["tab"];
    if (typeof tab === "string" && ADMIN_TAB_KEYS.includes(tab as AdminTab)) {
      return { tab: tab as AdminTab };
    }
    return {};
  },
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
  age: number | null;
  email: string;
  phone: string;
  speciality: string | null;
  level: Level;
  department: string;
  status: string;
  admin_role: string | null;
  blocked_until: string | null;
  created_at: string;
  school_certificate_url: string | null;
  identity_card_url: string | null;
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

const CHART_COLORS = ["#2e6bff", "#38bdf8", "#818cf8", "#a78bfa", "#f59e0b"];
const axisTick = { fill: "#94a3c8", fontSize: 10 };
const gridStroke = "rgba(255, 255, 255, 0.08)";

function leadershipRank(role: string | null) {
  const idx = LEADERSHIP_ORDER.indexOf(role ?? "");
  return idx === -1 ? LEADERSHIP_ORDER.length : idx;
}

function prettyRole(role: string | null | undefined) {
  if (!role) return "Admin";
  return role
    .split("_")
    .map((word) => (word ? `${word[0]}${word.slice(1)}` : word))
    .join(" ");
}

function avatarFallback(name: string | null, email: string | null) {
  const base = name?.trim() || email?.trim() || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: Users },
  { key: "events", label: "Submissions", icon: CalendarDays },
  { key: "leaders", label: "Leaders", icon: Award },
  { key: "team", label: "Team", icon: Users2 },
  { key: "admins", label: "Admins", icon: Shield },
] as const;

function isBlocked(member: Pick<Member, "blocked_until">) {
  return !!member.blocked_until && new Date(member.blocked_until).getTime() > Date.now();
}

function NoAccess({ label }: { label: string }) {
  return (
    <div className="admin-glass mt-8 rounded-3xl p-8 text-center">
      <Shield className="mx-auto size-8 text-[#94a3c8]" />
      <h2 className="mt-3 font-display text-xl font-bold text-white">No access</h2>
      <p className="mx-auto mt-2 max-w-md font-semibold text-[#94a3c8]">
        You don't have permission to view {label}. Ask the club owner to grant you access in the
        Admins page.
      </p>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-10 text-center font-semibold text-[#94a3c8]">
      {children}
    </div>
  );
}

/* ── Dashboard bento + KPI primitives ───────────────────────────────────── */
// Stagger wrapper: handles the cascading entrance of dashboard sections.
function DashSection({
  className = "",
  delay,
  children,
}: {
  className?: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div className={`dash-rise ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

// ~800ms ease-out count-up; reduced-motion renders the final value instantly.
function useCountUp(target: number, durationMs = 800) {
  const reduced = !!useReducedMotion();
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return value;
}

// Tiny no-axis trend line under a KPI number.
function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  const gradientId = useId();
  if (points.length < 2) return null;
  const w = 132;
  const h = 34;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p - min) / span) * (h - pad * 2),
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${(w - pad).toFixed(2)} ${h} L${pad} ${h} Z`;
  const last = coords[coords.length - 1];
  if (!last) return null;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.32} />
          <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill={tone} />
    </svg>
  );
}

// ↑/↓ percent pill computed from the last two points of a trend series.
function TrendDelta({
  points,
  suffix = "",
  goodWhenUp = true,
}: {
  points: number[];
  suffix?: string;
  goodWhenUp?: boolean;
}) {
  if (points.length < 2) return null;
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  if (prev === undefined || last === undefined) return null;
  if (!Number.isFinite(prev) || !Number.isFinite(last)) return null;
  if (prev <= 0) return <span className="font-bold text-[#94a3c8]">new</span>;
  const pct = Math.round(((last - prev) / prev) * 100);
  if (pct === 0) return <span className="font-bold text-[#94a3c8]">0{suffix}</span>;
  const up = pct > 0;
  const color = up ? (goodWhenUp ? "#34d399" : "#fcd34d") : "#fda4af";
  return (
    <span className="inline-flex items-center gap-1 font-bold" style={{ color }}>
      {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {up ? `+${pct}` : pct}
      {suffix}
    </span>
  );
}

function KpiCard({
  label,
  value,
  tone = "#6fa0ff",
  icon: Icon,
  spark,
  delta,
  sub,
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  icon?: LucideIcon;
  spark?: number[];
  delta?: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
}) {
  const count = useCountUp(value, 800);
  const reduced = !!useReducedMotion();
  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-bold leading-none" style={{ color: tone }}>
            {reduced ? value : count}
          </p>
          <p className="mt-1.5 text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
            {label}
          </p>
          {sub && <div className="mt-2 text-[11px] font-semibold text-[#94a3c8]">{sub}</div>}
        </div>
        {Icon && (
          <span
            className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${tone}24`,
              color: tone,
              boxShadow: `0 0 22px ${tone}38`,
            }}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3">
          <Sparkline points={spark} tone={tone} />
        </div>
      )}
      {delta && <div className="mt-1.5 flex items-center justify-end">{delta}</div>}
    </div>
  );

  const card =
    "admin-glass group rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/50 hover:ring-2 hover:ring-[#2e6bff]/25 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)]";

  if (onClick) {
    return (
      <button onClick={onClick} className={`${card} cursor-pointer`}>
        {body}
      </button>
    );
  }
  return <div className={`${card} cursor-default`}>{body}</div>;
}

// Glass tooltip used by every dashboard chart (replaces recharts' white box).
function GlassChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { fill?: string };
  }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[9rem] rounded-xl border border-white/15 bg-[#0a1226]/95 px-3.5 py-2.5 shadow-[0_18px_40px_-16px_rgba(6,11,24,0.9)] backdrop-blur-md">
      {label != null && label !== "" && (
        <p className="mb-1.5 text-xs font-extrabold text-white">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey ?? entry.name ?? "")}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? entry.payload?.fill ?? "#2e6bff" }}
            />
            <span className="font-semibold text-[#94a3c8]">{entry.name}</span>
            <span className="ml-auto pl-4 font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stepped funnel: Submitted → Checked in → Accepted, with flow connectors.
function RegistrationsFunnel({ campaigns }: { campaigns: DashboardCampaignFunnel[] }) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.submitted += c.submitted;
      acc.checked_in += c.checked_in;
      acc.pending += c.pending;
      acc.accepted += c.accepted;
      acc.removed += c.removed;
      return acc;
    },
    { submitted: 0, checked_in: 0, pending: 0, accepted: 0, removed: 0 },
  );
  const stages = [
    { key: "submitted", label: "Submitted", value: totals.submitted, tone: "#2e6bff" },
    { key: "checked_in", label: "Checked in", value: totals.checked_in, tone: "#38bdf8" },
    { key: "accepted", label: "Accepted", value: totals.accepted, tone: "#34d399" },
  ];
  return (
    <div className="mt-4">
      <div>
        {stages.map((stage, i) => {
          const pct = totals.submitted > 0 ? (stage.value / totals.submitted) * 100 : 0;
          return (
            <div key={stage.key}>
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-extrabold text-[#c7d2fe] uppercase">
                  {stage.label}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-lg transition-[width] duration-700 ease-out"
                    style={{
                      width: `${Math.max(pct > 0 ? 6 : 0, pct)}%`,
                      background: `linear-gradient(90deg, ${stage.tone}E6, ${stage.tone}59)`,
                    }}
                  />
                </div>
                <span
                  className="w-14 shrink-0 text-right font-display text-sm font-bold"
                  style={{ color: stage.tone }}
                >
                  {stage.value}
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] font-bold text-[#94a3c8]">
                  {totals.submitted > 0 ? `${Math.round(pct)}%` : "—"}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div className="flex justify-center py-0.5" aria-hidden="true">
                  <svg width="18" height="9" viewBox="0 0 18 9" className="text-white/25">
                    <path
                      d="M2 1 L9 8 L16 1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#94a3c8]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#fcd34d]" />
          {totals.pending} pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#f43f5e]" />
          {totals.removed} removed
        </span>
      </div>
    </div>
  );
}

// Shimmer skeleton shown while the stats query is loading.
function DashboardSkeleton() {
  const kpi = [
    { label: "Total members", cls: "md:col-span-3 lg:col-span-3" },
    { label: "Pending requests", cls: "md:col-span-3 lg:col-span-3" },
    { label: "Pending registrations", cls: "md:col-span-3 lg:col-span-3" },
    { label: "Open campaigns", cls: "md:col-span-3 lg:col-span-3" },
  ];
  return (
    <div
      className="grid grid-cols-1 items-start gap-5 md:grid-cols-6 lg:grid-cols-12"
      aria-label="Loading dashboard"
    >
      {kpi.map((card) => (
        <div key={card.label} className={`admin-glass rounded-2xl p-4 ${card.cls}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="admin-shimmer h-8 w-14 rounded-lg" />
              <div className="admin-shimmer h-3 w-28 rounded" />
            </div>
            <div className="admin-shimmer size-9 shrink-0 rounded-full" />
          </div>
          <div className="admin-shimmer mt-4 h-8 w-full rounded-md" />
        </div>
      ))}
      <div className="admin-glass rounded-3xl p-5 md:col-span-6 lg:col-span-8">
        <div className="admin-shimmer h-4 w-40 rounded" />
        <div className="admin-shimmer mt-5 h-56 w-full rounded-xl" />
      </div>
      <div className="admin-glass rounded-3xl p-5 md:col-span-6 lg:col-span-4">
        <div className="admin-shimmer mx-auto mt-2 h-48 w-48 rounded-full" />
      </div>
    </div>
  );
}

function campaignChartData(campaigns: DashboardStats["registrations"]["campaigns"]) {
  return campaigns.map((campaign) => ({
    ...campaign,
    shortTitle: campaign.title.length > 20 ? `${campaign.title.slice(0, 19)}…` : campaign.title,
  }));
}

type Post = {
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
  /**
   * The application settings that used to live in their own Registrations tab.
   * They are saved together with the announcement, because the card *is* the
   * application — see `AdminPostCampaign`.
   */
  campaign: AdminPostCampaign;
};

const blankPost: Post = {
  id: "",
  kind: ANNOUNCEMENT_KIND,
  title: "",
  subtitle: "",
  body: "",
  location: "",
  event_date: null,
  submission_type: "openday",
  campaign_id: null,
  is_pinned: false,
  published: true,
  created_at: "",
  campaign: { is_open: true, custom_questions: [] },
};

const blankLeader: AdminLeader = {
  id: "",
  name: "",
  position: "",
  description: "",
  image_url: "",
  display_order: 1,
  created_at: "",
};

const blankTeam: AdminTeamMember = {
  id: "",
  name: "",
  role_title: "",
  category: "professor",
  avatar_url: "",
  linkedin_url: "",
  display_order: 1,
  created_at: "",
};

const levelTint: Record<Level, string> = {
  L1: "bg-lilac/30 text-lilac-foreground",
  L2: "bg-blossom/25 text-blossom-foreground",
  L3: "bg-lemon/40 text-lemon-foreground",
  M1: "bg-mint/30 text-mint-foreground",
  M2: "bg-brand/20 text-brand-deep",
};

const teamCategoryTint: Record<AdminTeamMember["category"], string> = {
  student: "bg-[#34d399]/20 text-[#6ee7b7]",
  professor: "bg-[#2e6bff]/20 text-[#6fa0ff]",
  administration: "bg-[#f59e0b]/20 text-[#fcd34d]",
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
  const [manageId, setManageId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Member | null>(null);
  const [postDraft, setPostDraft] = useState<Post | null>(null);
  const [tab, setTab] = useState<AdminTab>(Route.useSearch().tab ?? "dashboard");
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaderDraft, setLeaderDraft] = useState<AdminLeader | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [teamDraft, setTeamDraft] = useState<AdminTeamMember | null>(null);
  const [teamUploading, setTeamUploading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileUploading, setProfileUploading] = useState(false);
  const [disableTarget, setDisableTarget] = useState<AdminRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [adminManageId, setAdminManageId] = useState<string | null>(null);

  const reduced = !!useReducedMotion();

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => getAdminStatus(),
  });

  const { data: session } = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => getAdminSession(),
  });

  const canAccess = (section: AdminSection): boolean =>
    session?.isOwner === true || (session?.sections.includes(section) ?? false);
  const isOwner = session?.isOwner ?? false;
  // Owner and president are peers for anything that acts on other admins.
  // Server-side `requireAdminManager` enforces the same rule, so this only
  // decides what gets rendered rather than what is allowed.
  const canManageAdmins = session?.canManageAdmins ?? false;

  // The owner row is exempt server-side (`assertNotOwnerRow`), so identify it
  // here too rather than offering buttons that can only fail. Matching on
  // email mirrors the server, which resolves the owner from OWNER_EMAIL.
  const isOwnerRowEmail = (email: string | null | undefined) =>
    Boolean(email && OWNER_EMAIL) && (email as string).toLowerCase() === OWNER_EMAIL;

  // Submissions absorbed the standalone Registrations tab, so either stored
  // permission key opens it. Keeping both avoids locking out admins who were
  // granted "registrations" before the merge.
  const canManageSubmissions = (): boolean => canAccess("events") || canAccess("registrations");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    enabled: isAdmin === true && canAccess("members"),
    queryFn: () => listMembers(),
  });

  // Campaigns are no longer edited in their own tab, but the announcement form
  // still needs them: to hydrate a draft's application settings, and to offer
  // attaching an existing registration to an announcement that has none (which
  // is how the pre-merge data looks) so its submissions are not orphaned.
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-campaigns"],
    enabled: isAdmin === true && canManageSubmissions(),
    queryFn: () => listRegistrationCampaigns(),
  });

  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  /** Campaigns whose kind matches what the draft is announcing. */
  const matchingCampaigns = campaigns.filter(
    (campaign) =>
      campaign.kind === CAMPAIGN_KIND_FOR_SUBMISSION[postDraft?.submission_type ?? "openday"],
  );

  /**
   * Open the announcement form, hydrating the application settings from the
   * campaign it already owns. A post with no campaign yet starts open and with
   * no questions — saving will create the form for it.
   */
  function startEditingPost(post: AdminPost) {
    const existing = post.campaign_id ? campaignById.get(post.campaign_id) : undefined;
    setPostDraft({
      ...post,
      campaign: {
        is_open: existing?.is_open ?? true,
        custom_questions: existing?.custom_questions ?? [],
      },
    });
  }

  function patchMembersCache(update: (prev: Member[]) => Member[]) {
    queryClient.setQueryData<Member[]>(["members"], (prev) => (prev ? update(prev) : prev));
  }

  const removeMember = useMutation({
    mutationFn: (id: string) => deleteMember({ data: id }),
    onSuccess: (_result, id) => {
      toast.success("Member removed");
      if (manageId === id) setManageId(null);
      setRemoveConfirm(null);
      patchMembersCache((prev) => prev.filter((member) => member.id !== id));
    },
    onError: () => toast.error("Could not remove this member"),
  });

  const saveMember = useMutation({
    mutationFn: (member: Member) => updateMember({ data: member }),
    onSuccess: (_result, member) => {
      toast.success("Member updated");
      setEditing(null);
      patchMembersCache((prev) =>
        prev.map((item) => (item.id === member.id ? { ...item, ...member } : item)),
      );
    },
    onError: () => toast.error("Could not save changes"),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-posts"],
    enabled: isAdmin === true && canAccess("events"),
    queryFn: () => listPosts(),
  });

  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    enabled: isAdmin === true,
    queryFn: () => getDashboardStats(),
    refetchInterval: 60_000,
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
    onSuccess: (_result, { id, until }) => {
      toast.success("Member blocked");
      setBlockTarget(null);
      patchMembersCache((prev) =>
        prev.map((member) =>
          member.id === id ? { ...member, blocked_until: new Date(until).toISOString() } : member,
        ),
      );
    },
    onError: () => toast.error("Could not block this member"),
  });

  const unblockMember = useMutation({
    mutationFn: (id: string) => unblockMemberApi({ data: id }),
    onSuccess: (_result, id) => {
      toast.success("Member unblocked");
      setBlockTarget(null);
      patchMembersCache((prev) =>
        prev.map((member) => (member.id === id ? { ...member, blocked_until: null } : member)),
      );
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

  const { data: leaders = [] } = useQuery({
    queryKey: ["admin-leaders"],
    enabled: isAdmin === true && canAccess("leaders"),
    queryFn: () => listLeaders(),
  });

  const saveLeader = useMutation({
    mutationFn: (leader: AdminLeader) => saveLeaderApi({ data: leader }),
    onSuccess: () => {
      toast.success("Leader saved");
      setLeaderDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["public-leaders"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save this leader"),
  });

  const removeLeader = useMutation({
    mutationFn: (id: string) => deleteLeader({ data: id }),
    onSuccess: () => {
      toast.success("Leader removed");
      queryClient.invalidateQueries({ queryKey: ["admin-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["public-leaders"] });
    },
    onError: () => toast.error("Could not remove this leader"),
  });

  const reorderLeaders = useMutation({
    mutationFn: (rows: { id: string; display_order: number }[]) => saveLeaderOrder({ data: rows }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leaders"] });
    },
    onError: () => toast.error("Could not reorder leaders"),
  });

  function moveLeader(index: number, direction: -1 | 1) {
    const next = [...leaders];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const item = next[index];
    if (!item) return;
    next.splice(index, 1);
    next.splice(target, 0, item);
    reorderLeaders.mutate(next.map((leader, i) => ({ id: leader.id, display_order: i + 1 })));
  }

  async function handleLeaderPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !leaderDraft) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please use a PNG, JPG or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `leaders/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("leaders").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data: publicUrl } = supabase.storage.from("leaders").getPublicUrl(path);
      setLeaderDraft({ ...leaderDraft, image_url: publicUrl.publicUrl });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  function submitLeader(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leaderDraft) return;
    if (!leaderDraft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!leaderDraft.position.trim()) {
      toast.error("Position is required");
      return;
    }
    if (!leaderDraft.image_url.trim()) {
      toast.error("Photo is required — upload one first");
      return;
    }
    if (leaderDraft.description.trim().length > MAX_LEADER_DESCRIPTION) {
      toast.error(`Description must be ${MAX_LEADER_DESCRIPTION} characters or fewer`);
      return;
    }
    saveLeader.mutate(leaderDraft);
  }

  const { data: team = [] } = useQuery({
    queryKey: ["admin-team"],
    enabled: isAdmin === true && canAccess("team"),
    queryFn: () => listTeam(),
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["admin-management-admins"],
    enabled: isAdmin === true && canManageAdmins,
    queryFn: () => listAdmins(),
  });

  // Officer applications. The emailed accept/cancel link is the primary path,
  // but the owner also needs to clear the queue from here.
  const { data: adminRequests = [] } = useQuery({
    queryKey: ["admin-requests"],
    enabled: isAdmin === true && canManageAdmins,
    queryFn: () => listAdminRequests(),
  });

  const pendingRequests = adminRequests.filter((request) => request.status === "pending");

  const decideRequest = useMutation({
    mutationFn: (input: { requestId: string; action: "approve" | "reject" }) =>
      decideAdminRequest({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.action === "approve" ? "Request approved" : "Request rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-management-admins"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update the request"),
  });

  const deleteRequest = useMutation({
    mutationFn: (requestId: string) => deleteAdminRequest({ data: requestId }),
    onSuccess: () => {
      toast.success("Request deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete the request"),
  });

  const saveProfile = useMutation({
    mutationFn: (input: { displayName: string; avatarUrl: string | null }) =>
      updateAdminProfile({ data: input }),
    onSuccess: () => {
      toast.success("Profile updated");
      setProfileOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-session"] });
      queryClient.invalidateQueries({ queryKey: ["admin-management-admins"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update profile"),
  });

  const toggleSection = useMutation({
    mutationFn: (input: { adminId: string; section: AdminSection; allowed: boolean }) =>
      setAdminSectionAllowed({ data: input }),
    onSuccess: () => {
      toast.success("Permissions updated");
      queryClient.invalidateQueries({ queryKey: ["admin-management-admins"] });
      queryClient.invalidateQueries({ queryKey: ["admin-session"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update permissions"),
  });

  const toggleDisabled = useMutation({
    mutationFn: (input: { adminId: string; disabled: boolean }) =>
      setAdminDisabled({ data: input }),
    onSuccess: () => {
      toast.success("Admin updated");
      setDisableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-management-admins"] });
      queryClient.invalidateQueries({ queryKey: ["admin-session"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update this admin"),
  });

  const [inviteLink, setInviteLink] = useState<{ email: string; link: string } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const sendInvite = useMutation({
    mutationFn: (input: { adminId: string }) => resendAdminInvite({ data: input }),
    onSuccess: (res) => {
      setInviteLink({ email: res.email, link: res.setPasswordLink });
      toast.success(
        res.emailSent
          ? `Invite link emailed to ${res.email}`
          : `Email failed — copy the link and send it to ${res.email}`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not create an invite link"),
  });

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink.link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      setInviteCopied(false);
    }
  }

  const deleteOfficer = useMutation({
    mutationFn: (input: { adminId: string }) => deleteAdmin({ data: input }),
    onSuccess: () => {
      toast.success("Admin removed");
      setDeleteTarget(null);
      setAdminManageId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-management-admins"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not remove this admin"),
  });

  function openProfile() {
    setProfileName(session?.displayName ?? "");
    setProfileAvatar(session?.avatarUrl ?? null);
    setProfileOpen(true);
    setSidebarOpen(false);
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProfile.mutate({ displayName: profileName, avatarUrl: profileAvatar });
  }

  async function handleProfilePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please use a PNG, JPG or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    setProfileUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `profiles/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("admin-avatars").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data: publicUrl } = supabase.storage.from("admin-avatars").getPublicUrl(path);
      setProfileAvatar(publicUrl.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setProfileUploading(false);
      event.target.value = "";
    }
  }

  const saveTeamMember = useMutation({
    mutationFn: (member: AdminTeamMember) => saveTeamMemberApi({ data: member }),
    onSuccess: () => {
      toast.success("Team member saved");
      setTeamDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
      queryClient.invalidateQueries({ queryKey: ["public-team"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save this team member"),
  });

  const removeTeamMember = useMutation({
    mutationFn: (id: string) => deleteTeamMemberApi({ data: id }),
    onSuccess: () => {
      toast.success("Team member removed");
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
      queryClient.invalidateQueries({ queryKey: ["public-team"] });
    },
    onError: () => toast.error("Could not remove this team member"),
  });

  const reorderTeam = useMutation({
    mutationFn: (rows: { id: string; display_order: number }[]) => saveTeamOrderApi({ data: rows }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
    },
    onError: () => toast.error("Could not reorder team members"),
  });

  function moveTeamMember(index: number, direction: -1 | 1) {
    const next = [...team];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const item = next[index];
    if (!item) return;
    next.splice(index, 1);
    next.splice(target, 0, item);
    reorderTeam.mutate(next.map((member, i) => ({ id: member.id, display_order: i + 1 })));
  }

  async function handleTeamPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !teamDraft) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please use a PNG, JPG or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    setTeamUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `team/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("team").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data: publicUrl } = supabase.storage.from("team").getPublicUrl(path);
      setTeamDraft({ ...teamDraft, avatar_url: publicUrl.publicUrl });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setTeamUploading(false);
      event.target.value = "";
    }
  }

  function submitTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamDraft) return;
    if (!teamDraft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!teamDraft.role_title.trim()) {
      toast.error("Role title is required");
      return;
    }
    if (!teamDraft.avatar_url.trim()) {
      toast.error("Photo is required — upload one first");
      return;
    }
    const linkedin_url = (teamDraft.linkedin_url ?? "").trim();
    if (linkedin_url && !isValidLinkedinUrl(linkedin_url)) {
      toast.error(
        "LinkedIn must be a valid linkedin.com URL (e.g. https://www.linkedin.com/in/name)",
      );
      return;
    }
    saveTeamMember.mutate(teamDraft);
  }

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

  const managedMember = members.find((member) => member.id === manageId) ?? null;

  const managedAdmin = admins.find((admin) => admin.user_id === adminManageId) ?? null;

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
        m.speciality ?? "",
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

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.key === "admins") return canManageAdmins;
      if (isOwner) return true;
      return session?.sections.includes(item.key) ?? false;
    });
  }, [isOwner, canManageAdmins, session]);

  const currentNavItem = filteredNavItems.find((item) => item.key === tab);
  const headerLabel = tab === "email" ? "Email" : (currentNavItem?.label ?? "");

  useEffect(() => {
    if (tab === "email") return;
    const firstKey = filteredNavItems[0]?.key;
    if (firstKey && !filteredNavItems.some((item) => item.key === tab)) {
      setTab(firstKey);
    }
  }, [tab, filteredNavItems]);

  if (roleLoading) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center font-bold text-white">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center px-5">
        <div className="admin-glass w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Not a club officer</h1>
          <p className="mt-2 font-semibold text-[#94a3c8]">
            This account doesn't have admin access to the member list.
          </p>
          {session?.email && (
            <p className="mt-1 text-sm font-semibold text-[#94a3c8]">
              Signed in as {session.email}
            </p>
          )}
          <button
            onClick={signOut}
            className="clay-sm mt-6 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (session?.disabled) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center px-5">
        <div className="admin-glass w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Access revoked</h1>
          <p className="mt-2 font-semibold text-[#94a3c8]">
            The club owner has paused your admin access. Contact the owner to restore it.
          </p>
          <button
            onClick={signOut}
            className="clay-sm mt-6 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <ShadTooltipProvider delayDuration={100}>
      <div className="admin-theme relative">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#060b18]/85 px-4 py-3 backdrop-blur-xl xl:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-white"
          >
            <Menu className="size-5" />
          </button>
          <p className="font-display text-lg font-bold text-white">
            Wavez <span className="text-[#6fa0ff]">Admin</span>
          </p>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-6 border-r border-white/10 bg-[#081020]/95 p-5 backdrop-blur-2xl transition-transform duration-200 xl:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[#2e6bff]/50 bg-[#2e6bff]/15 text-[#6fa0ff]">
                <Waves className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg leading-none font-bold text-white">Wavez</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold tracking-wide text-[#94a3c8]">
                  Member console
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] xl:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="flex flex-col gap-1.5">
            {filteredNavItems.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setManageId(null);
                    setSidebarOpen(false);
                  }}
                  className={`admin-nav-item ${active ? "admin-nav-item-active" : ""}`}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>

          <button onClick={openProfile} className="admin-nav-item text-xs">
            <User className="size-4 shrink-0" />
            My profile
          </button>

          <div className="mt-auto flex flex-col gap-2">
            <Link to="/" className="admin-nav-item text-xs">
              <ExternalLink className="size-4 shrink-0" />
              View public site
            </Link>
            <button
              onClick={signOut}
              className="admin-nav-item text-xs text-[#fda4af] hover:text-[#fda4af]"
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </button>
          </div>
        </aside>

        <aside className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col items-center gap-3 border-r border-white/10 bg-[#081020]/95 py-5 backdrop-blur-2xl xl:flex">
          <Link
            to="/"
            aria-label="Open the Wavez Club public site"
            className="grid size-11 place-items-center rounded-2xl border border-[#2e6bff]/50 bg-[#2e6bff]/15"
          >
            <img src={logo} alt="Wavez Club" className="size-7 rounded-lg object-contain" />
          </Link>

          <nav className="mt-2 flex flex-col items-center gap-1.5">
            {filteredNavItems.map(({ key, label, icon: Icon }) => (
              <ShadTooltip key={key}>
                <ShadTooltipTrigger asChild>
                  <button
                    aria-label={label}
                    onClick={() => {
                      setTab(key);
                      setManageId(null);
                    }}
                    className={`grid size-11 place-items-center rounded-2xl transition-colors ${
                      tab === key
                        ? "bg-[#2e6bff] text-white shadow-[0_10px_30px_-12px_rgba(46,107,255,0.7)]"
                        : "text-[#94a3c8] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="size-5" />
                  </button>
                </ShadTooltipTrigger>
                <ShadTooltipContent
                  side="right"
                  className="border border-white/10 bg-[#101c36] font-semibold text-white"
                >
                  {label}
                </ShadTooltipContent>
              </ShadTooltip>
            ))}
          </nav>

          <div className="mt-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6bff]"
                >
                  <Avatar className="size-10 ring-2 ring-white/10">
                    <AvatarImage src={session?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-[#2e6bff]/25 font-display text-sm font-bold text-white">
                      {avatarFallback(session?.displayName ?? null, session?.email ?? null)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                sideOffset={12}
                align="end"
                className="w-60 border-white/10 bg-[#0a1226] text-white"
              >
                <DropdownMenuLabel className="truncate font-bold text-white">
                  {session?.displayName?.trim() || "Club admin"}
                </DropdownMenuLabel>
                <DropdownMenuLabel className="pt-0 text-xs font-semibold text-[#94a3c8]">
                  {session?.isOwner ? "President" : prettyRole(session?.role || null)}
                </DropdownMenuLabel>
                <DropdownMenuLabel className="truncate pt-0 text-[11px] font-medium text-[#6fa0ff]">
                  {session?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={openProfile}
                  className="cursor-pointer focus:bg-[#2e6bff]/20 focus:text-white"
                >
                  <User className="size-4" />
                  My profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/" })}
                  className="cursor-pointer focus:bg-[#2e6bff]/20 focus:text-white"
                >
                  <ExternalLink className="size-4" />
                  Public site
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="cursor-pointer text-[#fda4af] focus:bg-[#f43f5e]/20 focus:text-[#fda4af]"
                >
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <main className="relative z-10 min-h-screen xl:pl-20">
          <div className="mx-auto max-w-6xl px-5 py-8">
            <div className="admin-glass rounded-3xl p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                    Admin dashboard
                  </p>
                  <h1 className="mt-0.5 font-display text-2xl font-bold text-white">
                    Member management
                  </h1>
                </div>
                <span className="hidden shrink-0 rounded-full border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase sm:inline-block">
                  {headerLabel}
                </span>
              </div>

              {tab === "dashboard" && (
                <div className="mt-6">
                  {statsPending && !stats && <DashboardSkeleton />}
                  {statsError && !stats && (
                    <p className="admin-glass rounded-2xl px-4 py-10 text-center font-semibold text-[#fda4af]">
                      Could not load the dashboard.
                    </p>
                  )}

                  {stats && (
                    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-6 lg:grid-cols-12">
                      {/* ── 1 · KPI cards — count-up, sparkline, delta ── */}
                      {canAccess("members") && (
                        <DashSection delay={0} className="md:col-span-3 lg:col-span-3">
                          <KpiCard
                            label="Total members"
                            value={stats.members.total}
                            tone="#2e6bff"
                            icon={Users}
                            spark={stats.members.by_month.map((m) => m.cumulative)}
                            delta={
                              <TrendDelta
                                points={stats.members.by_month.map((m) => m.cumulative)}
                                suffix="% vs last month"
                              />
                            }
                          />
                        </DashSection>
                      )}
                      {isOwner && (
                        <DashSection delay={0} className="md:col-span-3 lg:col-span-3">
                          <KpiCard
                            label="Pending requests"
                            value={stats.adminRequests.pending_count}
                            tone="#a78bfa"
                            icon={Shield}
                            spark={(stats.adminRequests.by_month ?? []).map((m) => m.count)}
                            delta={
                              <TrendDelta
                                points={(stats.adminRequests.by_month ?? []).map((m) => m.count)}
                                suffix="% vs last month"
                              />
                            }
                            onClick={() => setTab("admins")}
                          />
                        </DashSection>
                      )}
                      {canManageSubmissions() && (
                        <DashSection delay={0} className="md:col-span-3 lg:col-span-3">
                          <KpiCard
                            label="Pending registrations"
                            value={stats.registrations.pending_total}
                            tone="#fcd34d"
                            icon={ClipboardList}
                            spark={(stats.registrations.by_month ?? []).map((m) => m.submitted)}
                            delta={
                              <TrendDelta
                                points={(stats.registrations.by_month ?? []).map(
                                  (m) => m.submitted,
                                )}
                                suffix="% vs last month"
                              />
                            }
                            onClick={() => setTab("events")}
                          />
                        </DashSection>
                      )}
                      {canManageSubmissions() && (
                        <DashSection delay={0} className="md:col-span-3 lg:col-span-3">
                          <KpiCard
                            label="Open campaigns"
                            value={stats.registrations.open_campaigns}
                            tone="#34d399"
                            icon={Megaphone}
                          />
                        </DashSection>
                      )}

                      {/* ── 2 · Members analytics — featured growth area ── */}
                      {canAccess("members") && (
                        <DashSection delay={0.08} className="md:col-span-6 lg:col-span-8">
                          <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h2 className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                                Members analytics
                              </h2>
                              <span className="rounded-full border border-[#f43f5e]/30 bg-[#f43f5e]/10 px-3 py-1 text-[11px] font-extrabold text-[#fda4af] uppercase">
                                Currently blocked · {stats.members.blocked}
                              </span>
                            </div>

                            <div className="mt-5">
                              {stats.members.by_month.every((m) => m.cumulative === 0) ? (
                                <EmptyHint>
                                  No members yet — add members from the Members tab to see growth.
                                </EmptyHint>
                              ) : (
                                <div className="h-56">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.members.by_month}>
                                      <defs>
                                        <linearGradient
                                          id="memberGrowthFill"
                                          x1="0"
                                          y1="0"
                                          x2="0"
                                          y2="1"
                                        >
                                          <stop
                                            offset="0%"
                                            stopColor="#2e6bff"
                                            stopOpacity={0.45}
                                          />
                                          <stop
                                            offset="100%"
                                            stopColor="#2e6bff"
                                            stopOpacity={0.03}
                                          />
                                        </linearGradient>
                                      </defs>
                                      <XAxis
                                        dataKey="month"
                                        tick={axisTick}
                                        stroke={gridStroke}
                                        tickLine={false}
                                        axisLine={false}
                                      />
                                      <YAxis
                                        allowDecimals={false}
                                        width={28}
                                        tick={axisTick}
                                        stroke={gridStroke}
                                        tickLine={false}
                                        axisLine={false}
                                      />
                                      <CartesianGrid stroke={gridStroke} vertical={false} />
                                      <Tooltip content={<GlassChartTooltip />} />
                                      <Area
                                        type="monotone"
                                        dataKey="cumulative"
                                        name="Members"
                                        stroke="#2e6bff"
                                        strokeWidth={2}
                                        fill="url(#memberGrowthFill)"
                                        dot={{ r: 3, fill: "#2e6bff" }}
                                        activeDot={{ r: 5 }}
                                        isAnimationActive={!reduced}
                                        animationDuration={800}
                                        animationEasing="ease-out"
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                              <p className="mx-2 mt-1 text-[11px] font-semibold text-[#94a3c8]">
                                Cumulative member count by month
                              </p>
                            </div>
                          </section>
                        </DashSection>
                      )}

                      {/* ── 3 · Members by level — donut with center total ── */}
                      {canAccess("members") && (
                        <DashSection delay={0.14} className="md:col-span-6 lg:col-span-4">
                          <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                            <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                              Members by level
                            </p>
                            <div className="mt-3 h-56">
                              {stats.members.by_level.length === 0 ? (
                                <EmptyHint>No data yet.</EmptyHint>
                              ) : (
                                <div className="relative h-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={stats.members.by_level}
                                        dataKey="value"
                                        nameKey="level"
                                        innerRadius={46}
                                        outerRadius={72}
                                        paddingAngle={3}
                                        cornerRadius={5}
                                        isAnimationActive={!reduced}
                                        animationDuration={700}
                                        animationEasing="ease-out"
                                        animationBegin={120}
                                      >
                                        {stats.members.by_level.map((entry, i) => (
                                          <Cell
                                            key={entry.level}
                                            fill={
                                              CHART_COLORS[i % CHART_COLORS.length] ?? "#2e6bff"
                                            }
                                          />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<GlassChartTooltip />} />
                                      <Legend
                                        wrapperStyle={{
                                          color: "#c7d2fe",
                                          fontSize: 12,
                                          fontWeight: 600,
                                        }}
                                        iconSize={8}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="font-display text-2xl font-bold text-white">
                                      {stats.members.by_level.reduce(
                                        (sum, entry) => sum + entry.value,
                                        0,
                                      )}
                                    </p>
                                    <p className="text-[10px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                                      Members
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
                        </DashSection>
                      )}

                      {/* ── 4 · Members by department ── */}
                      {canAccess("members") && (
                        <DashSection delay={0.2} className="md:col-span-6 lg:col-span-4">
                          <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                            <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                              Members by department
                            </p>
                            <div className="mt-3 h-56">
                              {stats.members.by_department.length === 0 ? (
                                <EmptyHint>No data yet.</EmptyHint>
                              ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={stats.members.by_department}>
                                    <defs>
                                      <linearGradient id="deptBarFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2e6bff" />
                                        <stop
                                          offset="100%"
                                          stopColor="#2e6bff"
                                          stopOpacity={0.45}
                                        />
                                      </linearGradient>
                                    </defs>
                                    <XAxis
                                      dataKey="department"
                                      tick={axisTick}
                                      interval={0}
                                      stroke={gridStroke}
                                      tickLine={false}
                                      axisLine={false}
                                    />
                                    <YAxis
                                      allowDecimals={false}
                                      width={28}
                                      tick={axisTick}
                                      stroke={gridStroke}
                                      tickLine={false}
                                      axisLine={false}
                                    />
                                    <Tooltip
                                      content={<GlassChartTooltip />}
                                      cursor={{ fill: "rgba(46,107,255,0.15)" }}
                                    />
                                    <Bar
                                      dataKey="value"
                                      fill="url(#deptBarFill)"
                                      radius={[6, 6, 0, 0]}
                                      maxBarSize={36}
                                      isAnimationActive={!reduced}
                                      animationDuration={700}
                                      animationEasing="ease-out"
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              )}
                            </div>
                          </section>
                        </DashSection>
                      )}

                      {/* ── 3 · Registrations analytics — stage funnel ── */}
                      {canManageSubmissions() && (
                        <DashSection delay={0.26} className="md:col-span-6 lg:col-span-8">
                          <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h2 className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                                Registrations analytics
                              </h2>
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase ${
                                  stats.registrations.acceptance_rate === null
                                    ? "border-white/10 bg-white/5 text-[#94a3c8]"
                                    : "border-[#34d399]/30 bg-[#34d399]/10 text-[#6ee7b7]"
                                }`}
                              >
                                {stats.registrations.acceptance_rate === null
                                  ? "No decisions yet"
                                  : `${stats.registrations.acceptance_rate}% accepted`}
                              </span>
                            </div>

                            {stats.registrations.campaigns.length === 0 ? (
                              <div className="mt-4">
                                <EmptyHint>
                                  No open registration campaigns yet — open one from the
                                  Registrations tab.
                                </EmptyHint>
                              </div>
                            ) : (
                              <div className="mt-4">
                                <RegistrationsFunnel campaigns={stats.registrations.campaigns} />
                                <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                                  {campaignChartData(stats.registrations.campaigns).map(
                                    (campaign) => {
                                      const rate =
                                        campaign.submitted > 0
                                          ? Math.round(
                                              (campaign.checked_in / campaign.submitted) * 100,
                                            )
                                          : 0;
                                      return (
                                        <div key={campaign.id} className="flex items-center gap-3">
                                          <span
                                            className="w-44 shrink-0 truncate text-xs font-bold text-white"
                                            title={campaign.title}
                                          >
                                            {campaign.shortTitle}
                                          </span>
                                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                                            <div
                                              className="h-full rounded-full bg-[#38bdf8]"
                                              style={{ width: `${rate}%` }}
                                            />
                                          </div>
                                          <span className="shrink-0 text-[11px] font-semibold text-[#94a3c8]">
                                            {campaign.checked_in}/{campaign.submitted} checked in
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                                {stats.registrations.campaigns.length <
                                  stats.registrations.open_campaigns && (
                                  <p className="mx-2 mt-3 text-[11px] font-semibold text-[#94a3c8]">
                                    Showing {stats.registrations.campaigns.length} of{" "}
                                    {stats.registrations.open_campaigns} open campaigns
                                  </p>
                                )}
                              </div>
                            )}
                          </section>
                        </DashSection>
                      )}

                      {/* ── 4 · Submissions analytics — gradient area ── */}
                      {canAccess("events") && (
                        <DashSection delay={0.32} className="md:col-span-6 lg:col-span-7">
                          <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h2 className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                                Submissions analytics
                              </h2>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-3 py-1 text-[11px] font-extrabold text-[#6fa0ff] uppercase">
                                  {stats.events.published} live
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-[#94a3c8] uppercase">
                                  {stats.events.drafts} hidden
                                </span>
                              </div>
                            </div>

                            {stats.events.by_month.every((e) => e.count === 0) ? (
                              <div className="mt-4">
                                <EmptyHint>
                                  No announcements yet — publish one from the Submissions tab.
                                </EmptyHint>
                              </div>
                            ) : (
                              <div className="mt-4">
                                <div className="h-52">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.events.by_month}>
                                      <defs>
                                        <linearGradient
                                          id="eventFreqFill"
                                          x1="0"
                                          y1="0"
                                          x2="0"
                                          y2="1"
                                        >
                                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                                          <stop
                                            offset="100%"
                                            stopColor="#38bdf8"
                                            stopOpacity={0.03}
                                          />
                                        </linearGradient>
                                      </defs>
                                      <XAxis
                                        dataKey="month"
                                        tick={axisTick}
                                        stroke={gridStroke}
                                        tickLine={false}
                                        axisLine={false}
                                      />
                                      <YAxis
                                        allowDecimals={false}
                                        width={28}
                                        tick={axisTick}
                                        stroke={gridStroke}
                                        tickLine={false}
                                        axisLine={false}
                                      />
                                      <CartesianGrid stroke={gridStroke} vertical={false} />
                                      <Tooltip content={<GlassChartTooltip />} />
                                      <Area
                                        type="monotone"
                                        dataKey="count"
                                        name="Submissions"
                                        stroke="#38bdf8"
                                        strokeWidth={2}
                                        fill="url(#eventFreqFill)"
                                        dot={{ r: 3, fill: "#38bdf8" }}
                                        activeDot={{ r: 5 }}
                                        isAnimationActive={!reduced}
                                        animationDuration={800}
                                        animationEasing="ease-out"
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                                <p className="mx-2 mt-1 text-[11px] font-semibold text-[#94a3c8]">
                                  Submission announcements by month — last 6 months
                                </p>
                              </div>
                            )}
                          </section>
                        </DashSection>
                      )}

                      {/* ── 5 · Admin & team ── */}
                      <DashSection delay={0.32} className="md:col-span-6 lg:col-span-12">
                        <section className="admin-glass rounded-3xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2e6bff]/30 hover:shadow-[0_18px_40px_-18px_rgba(46,107,255,0.45)] md:p-6">
                          <h2 className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                            Admin & team
                          </h2>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                                Active admins
                              </p>
                              <p className="mt-2 font-display text-3xl font-bold text-[#6fa0ff]">
                                {stats.admins.active_total}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold text-[#94a3c8]">
                                {stats.admins.total} admin account
                                {stats.admins.total === 1 ? "" : "s"} registered
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                                By role
                              </p>
                              {stats.admins.by_role.length === 0 ? (
                                <div className="mt-3">
                                  <EmptyHint>No active admins yet.</EmptyHint>
                                </div>
                              ) : (
                                <div className="mt-3 space-y-2.5">
                                  {stats.admins.by_role.map((entry) => (
                                    <div key={entry.role}>
                                      <div className="flex items-center justify-between text-xs font-bold text-white">
                                        <span>{prettyRole(entry.role)}</span>
                                        <span className="text-[#94a3c8]">{entry.value}</span>
                                      </div>
                                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                                        <div
                                          className="h-1.5 rounded-full bg-[#2e6bff]"
                                          style={{
                                            width: `${
                                              stats.admins.active_total > 0
                                                ? (entry.value / stats.admins.active_total) * 100
                                                : 0
                                            }%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {isOwner && (
                            <div className="mt-5 border-t border-white/10 pt-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                                  Pending admin requests
                                </p>
                                {stats.adminRequests.pending.length > 0 && (
                                  <button
                                    onClick={() => setTab("admins")}
                                    className="text-[11px] font-extrabold text-[#6fa0ff] transition hover:text-white"
                                  >
                                    Manage in Admins
                                  </button>
                                )}
                              </div>
                              {stats.adminRequests.pending.length === 0 ? (
                                <p className="mt-3 text-sm font-semibold text-[#94a3c8]">
                                  No pending admin requests.
                                </p>
                              ) : (
                                <ul className="mt-3 space-y-2">
                                  {stats.adminRequests.pending.map((request) => (
                                    <li
                                      key={request.id}
                                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-white">
                                          {request.name}
                                        </p>
                                        <p className="truncate text-xs font-semibold text-[#94a3c8]">
                                          {request.email} · {prettyRole(request.role)}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => setTab("admins")}
                                        className="clay-sm shrink-0 rounded-xl bg-[#2e6bff] px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-[#2e6bff]/90"
                                      >
                                        Review
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </section>
                      </DashSection>
                    </div>
                  )}
                </div>
              )}

              {(tab === "members" || tab === "events") && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="admin-glass rounded-2xl p-4">
                    <p className="font-display text-3xl font-bold text-[#6fa0ff]">
                      {members.length}
                    </p>
                    <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                      Total
                    </p>
                  </div>
                  {LEVELS.map((lvl) => (
                    <div key={lvl} className="admin-glass rounded-2xl p-4">
                      <p className="font-display text-3xl font-bold text-[#6fa0ff]">
                        {members.filter((m) => m.level === lvl).length}
                      </p>
                      <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
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
                      className="clay-sm ml-auto flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)] disabled:opacity-60"
                    >
                      <Download className="size-4" />
                      Export .xlsx
                    </button>
                  </div>

                  <div className="admin-glass mt-6 overflow-x-auto rounded-2xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/[0.04] text-left text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                          <th className="px-5 py-3">Member</th>
                          <th className="px-5 py-3">Join date</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Department/Level</th>
                          <th className="px-5 py-3 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {isLoading && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-8 text-center font-semibold text-[#94a3c8]"
                            >
                              Loading…
                            </td>
                          </tr>
                        )}
                        {filtered.length === 0 && !isLoading && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-8 text-center font-semibold text-[#94a3c8]"
                            >
                              No matching members found.
                            </td>
                          </tr>
                        )}
                        {filtered.map((member) => (
                          <tr key={member.id} className="transition-colors hover:bg-white/[0.04]">
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-white">{member.full_name}</p>
                              {member.admin_role && (
                                <p className="text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                                  {ROLE_LABELS[member.admin_role] ?? member.admin_role}
                                </p>
                              )}
                              <p className="text-xs text-[#94a3c8]">
                                {member.phone} — {member.email}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 font-semibold whitespace-nowrap">
                              {new Date(member.created_at).toLocaleDateString("en-GB")}
                            </td>
                            <td className="px-5 py-3.5">
                              {isBlocked(member) ? (
                                <div>
                                  <span className="inline-block rounded-full bg-[#f43f5e]/20 px-3 py-1 text-[11px] font-extrabold text-[#fda4af] uppercase">
                                    Blocked
                                  </span>
                                  <p className="mt-1 text-[11px] font-bold text-[#fda4af]">
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
                                      ? "bg-[#34d399] text-[#04121a]"
                                      : "bg-[#f59e0b]/20 text-[#fcd34d]"
                                  }`}
                                >
                                  {member.status}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-white">{member.level}</p>
                              <p className="text-xs text-[#94a3c8]">
                                {member.department}
                                {member.speciality ? ` · ${member.speciality}` : ""}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setManageId(member.id)}
                                className="clay-sm inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/25 px-3 py-2 text-xs font-bold text-[#a5c3ff] transition-colors hover:bg-[#2e6bff]/40"
                              >
                                <Settings2 className="size-3.5" /> Manage
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
              <div className="admin-glass mt-6 rounded-3xl p-6 md:p-8">
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
                        className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)] disabled:opacity-60"
                      >
                        <Send className="size-4" />
                        Compose email
                      </button>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                      {selectedIds.size} of {members.length} selected
                    </p>

                    <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white">
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

                    <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                      {members.map((member) => (
                        <label
                          key={member.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
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
                          <span className="text-sm font-bold text-white">{member.full_name}</span>
                          <span className="ml-auto text-xs text-[#94a3c8]">{member.email}</span>
                        </label>
                      ))}
                    </div>

                    {drafts.length > 0 && (
                      <div className="mt-6 overflow-x-auto">
                        <h3 className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                          Saved drafts
                        </h3>
                        <div className="mt-2 grid gap-2">
                          {drafts.map((draft) => (
                            <div
                              key={draft.id}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
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
                                <p className="font-bold text-white">
                                  {draft.subject || "(no subject)"}
                                </p>
                                <p className="text-xs text-[#94a3c8]">
                                  {draft.recipient_ids.length} recipients ·{" "}
                                  {new Date(draft.created_at).toLocaleDateString("en-GB")}
                                </p>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Delete this draft?")) removeDraft.mutate(draft.id);
                                }}
                                className="clay-sm inline-flex items-center gap-1 rounded-lg bg-[#f43f5e]/20 px-3 py-1.5 text-xs font-bold text-[#fda4af]"
                              >
                                <Trash2 className="size-3.5" /> Delete
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
                      <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                        Compose email
                      </p>
                      <button
                        onClick={() => setEmailView("recipients")}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#94a3c8] transition-colors hover:text-white"
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
                            sendEmail.mutate({
                              recipients,
                              subject: emailSubject,
                              body: emailBody,
                            });
                          }}
                          disabled={
                            sendEmail.isPending || !emailSubject.trim() || !emailBody.trim()
                          }
                          className="clay-md flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-60"
                        >
                          <Send className="size-4" />
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
                          disabled={
                            saveDraft.isPending || (!emailSubject.trim() && !emailBody.trim())
                          }
                          className="clay-sm inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b]/20 px-6 py-3 font-bold text-[#fcd34d] disabled:opacity-60"
                        >
                          <Save className="size-4" />
                          {saveDraft.isPending ? "Saving…" : "Save draft"}
                        </button>
                        <button
                          onClick={() => setEmailView("recipients")}
                          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
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
              <div className="admin-glass mt-8 rounded-3xl p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                      Home page content
                    </p>
                    <h2 className="font-display text-2xl font-bold text-white">Submissions</h2>
                    <p className="mt-1 max-w-2xl text-sm font-semibold text-[#94a3c8]">
                      Everything about a submission lives here: the announcement, the form students
                      fill in from its card, and the submissions that come back — review them and
                      check students in below.
                    </p>
                  </div>
                  <button
                    onClick={() => setPostDraft({ ...blankPost })}
                    className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)]"
                  >
                    <FilePlus2 className="size-4" />
                    New submission
                  </button>
                </div>

                {postDraft && (
                  <form
                    className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      savePost.mutate(postDraft);
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-extrabold text-muted-foreground uppercase">
                          Title
                        </label>
                        <input
                          required
                          maxLength={140}
                          className={fieldClass}
                          placeholder="Wavez Open Day 2026"
                          value={postDraft.title}
                          onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-extrabold text-muted-foreground uppercase">
                          Subtitle
                        </label>
                        <input
                          maxLength={180}
                          className={fieldClass}
                          placeholder="One line: who should apply and what they get."
                          value={postDraft.subtitle}
                          onChange={(e) => setPostDraft({ ...postDraft, subtitle: e.target.value })}
                        />
                        <p className="mt-1.5 text-[11px] font-semibold text-[#94a3c8]">
                          Sits under the title in a smaller size — the promise, not the detail.
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-extrabold text-muted-foreground uppercase">
                          What are they submitting to
                        </label>
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {SUBMISSION_TYPES.map((type) => (
                            <button
                              key={type}
                              type="button"
                              aria-pressed={postDraft.submission_type === type}
                              onClick={() =>
                                setPostDraft({
                                  ...postDraft,
                                  submission_type: type,
                                  // The form a student gets is derived from this on
                                  // save, so switching type is enough — the
                                  // registration (and the submissions already in
                                  // it) stays attached and simply offers the
                                  // other form from now on.
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                postDraft.submission_type === type
                                  ? type === "openday"
                                    ? "border-[#2e6bff]/50 bg-[#2e6bff]/15"
                                    : "border-[#34d399]/50 bg-[#34d399]/10"
                                  : "border-white/10 bg-black/20 hover:bg-white/5"
                              }`}
                            >
                              <p
                                className={`text-sm font-bold ${
                                  postDraft.submission_type !== type
                                    ? "text-white"
                                    : type === "openday"
                                      ? "text-[#6fa0ff]"
                                      : "text-[#6ee7b7]"
                                }`}
                              >
                                {SUBMISSION_TYPE_KIND_LABEL[type]}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                                {SUBMISSION_TYPE_HINT[type]}
                              </p>
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-[#94a3c8]">
                          The card leads with this label, so students know what they are applying to
                          before they read the title.
                        </p>
                      </div>

                      {/* ── The application itself ────────────────────────── */}
                      <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-display text-base font-bold text-white">
                              Application
                            </h3>
                            <p className="text-xs font-semibold text-[#94a3c8]">
                              Students apply from this announcement's card — there is no separate
                              registration page.{" "}
                              {postDraft.submission_type === "openday"
                                ? "They get the membership wizard: profile, two documents, then these questions."
                                : "They get a single-step form: contact details, then these questions. No documents."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPostDraft({
                                ...postDraft,
                                campaign: {
                                  ...postDraft.campaign,
                                  is_open: !postDraft.campaign.is_open,
                                },
                              })
                            }
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold uppercase transition-colors ${
                              postDraft.campaign.is_open
                                ? "border-[#34d399]/40 bg-[#34d399]/10 text-[#6ee7b7]"
                                : "border-white/10 bg-white/5 text-[#94a3c8]"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${
                                postDraft.campaign.is_open ? "bg-[#34d399]" : "bg-[#94a3c8]"
                              }`}
                            />
                            {postDraft.campaign.is_open ? "Accepting" : "Closed"}
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-[#94a3c8]">
                          {postDraft.campaign.is_open
                            ? "The card shows the application form. Closing it keeps the announcement published but replaces the form with “Registration opening soon”."
                            : "The announcement stays on the home page, but the card will show “Registration opening soon” instead of a form."}
                        </p>

                        {/* One-time escape hatch for announcements created before this
                            merge: attaching an existing registration keeps its
                            submissions instead of orphaning them on a new form. */}
                        {!postDraft.campaign_id && matchingCampaigns.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-4">
                            <label
                              className="text-xs font-extrabold text-[#fcd34d] uppercase"
                              htmlFor="post-attach-campaign"
                            >
                              Attach an existing registration
                            </label>
                            <select
                              id="post-attach-campaign"
                              className={fieldClass}
                              value=""
                              onChange={(e) => {
                                const target = campaignById.get(e.target.value);
                                if (!target) return;
                                setPostDraft({
                                  ...postDraft,
                                  campaign_id: target.id,
                                  campaign: {
                                    is_open: target.is_open,
                                    custom_questions: target.custom_questions ?? [],
                                  },
                                });
                              }}
                            >
                              <option value="">
                                Choose — keeps the submissions already in that registration
                              </option>
                              {matchingCampaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.title} — {campaign.submission_count} submission
                                  {campaign.submission_count === 1 ? "" : "s"}
                                  {campaign.is_open ? "" : " (closed)"}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1.5 text-[11px] font-semibold text-[#fcd34d]">
                              This announcement has no form of its own. Attaching an existing one
                              keeps the submissions students already sent; saving without attaching
                              creates a fresh, empty form.
                            </p>
                          </div>
                        )}

                        {postDraft.campaign_id && (
                          <p className="mt-3 text-[11px] font-semibold text-[#94a3c8]">
                            {(() => {
                              const target = campaignById.get(postDraft.campaign_id ?? "");
                              return target
                                ? `Linked to “${target.title}” · ${target.submission_count} submission${target.submission_count === 1 ? "" : "s"} so far`
                                : "Linked to a registration that is no longer in the list — saving will create a new one.";
                            })()}
                          </p>
                        )}
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
                        <p className="mt-1.5 text-[11px] font-semibold text-[#94a3c8]">
                          Adds a "Today / Tomorrow / In N days" chip inside the next 7 days.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground uppercase">
                          Place
                        </label>
                        <input
                          maxLength={160}
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
                          maxLength={4000}
                          className={fieldClass}
                          placeholder="What happens, who can apply, what they should bring…"
                          value={postDraft.body}
                          onChange={(e) => setPostDraft({ ...postDraft, body: e.target.value })}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={postDraft.is_pinned}
                          onChange={(e) =>
                            setPostDraft({ ...postDraft, is_pinned: e.target.checked })
                          }
                        />
                        Pin to the top of the feed
                      </label>

                      <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={postDraft.published}
                          onChange={(e) =>
                            setPostDraft({ ...postDraft, published: e.target.checked })
                          }
                        />
                        Visible on the home page
                      </label>

                      <div className="flex gap-3 sm:col-span-2">
                        <button
                          type="submit"
                          disabled={savePost.isPending}
                          className="clay-md rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                        >
                          Save announcement
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostDraft(null)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <CustomQuestionsEditor
                        questions={postDraft.campaign.custom_questions}
                        onChange={(custom_questions) =>
                          setPostDraft({
                            ...postDraft,
                            campaign: { ...postDraft.campaign, custom_questions },
                          })
                        }
                      />
                    </div>

                    {/* Live preview — the exact card the public feed renders. */}
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                        Live card preview
                      </p>
                      <p className="mt-1 mb-4 text-[11px] font-semibold text-[#94a3c8]">
                        Rendered with this console's colours — the public card uses the light theme.
                      </p>
                      <SubmissionAnnouncementCard announcement={postDraft} index={0} preview />
                    </div>
                  </form>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {posts.length === 0 && (
                    <p className="font-semibold text-[#94a3c8]">
                      No announcements yet — publish the first open-day or event submission.
                    </p>
                  )}
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5 transition-colors hover:bg-black/30"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase ${
                            post.submission_type === "openday"
                              ? "bg-[#2e6bff]/20 text-[#6fa0ff]"
                              : "bg-[#34d399]/20 text-[#6ee7b7]"
                          }`}
                        >
                          {SUBMISSION_TYPE_LABEL[post.submission_type]}
                        </span>
                        {post.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#818cf8]/20 px-3 py-1 text-[11px] font-extrabold text-[#c7d2fe] uppercase">
                            <Pin
                              aria-hidden="true"
                              className="size-3 -rotate-[20deg]"
                              strokeWidth={2.5}
                            />
                            pinned
                          </span>
                        )}
                        {!post.published && (
                          <span className="rounded-full bg-[#f59e0b]/20 px-3 py-1 text-[11px] font-extrabold text-[#fcd34d] uppercase">
                            hidden
                          </span>
                        )}
                        {post.event_date && (
                          <span className="text-xs font-bold text-[#94a3c8]">
                            {new Date(post.event_date).toLocaleString("en-GB")}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-display text-lg font-bold text-white">{post.title}</p>
                      {post.subtitle && (
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#6fa0ff]">
                          {post.subtitle}
                        </p>
                      )}
                      {post.location && (
                        <p className="mt-1 text-xs font-bold text-[#94a3c8]">📍 {post.location}</p>
                      )}
                      <p className="mt-2 line-clamp-3 text-sm font-semibold text-[#94a3c8]">
                        {post.body}
                      </p>
                      {(() => {
                        const campaign = post.campaign_id
                          ? campaignById.get(post.campaign_id)
                          : undefined;
                        return (
                          <>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => startEditingPost(post)}
                                className="clay-sm inline-flex items-center gap-1 rounded-lg bg-[#34d399]/20 px-3 py-1.5 text-xs font-bold text-[#6ee7b7]"
                              >
                                <Pencil className="size-3.5" /> Edit
                              </button>
                              {campaign && (
                                <Link
                                  to="/gestion/admin/submissions/$campaignId"
                                  params={{ campaignId: campaign.id }}
                                  title={
                                    campaign.is_open
                                      ? "Review the students who submitted"
                                      : "This registration is closed — you can still review it"
                                  }
                                  className="clay-sm inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/15 px-3 py-1.5 text-xs font-bold text-[#6fa0ff] transition-colors hover:bg-[#2e6bff]/25"
                                >
                                  <Users className="size-3.5" />
                                  Submissions · {campaign.submission_count}
                                </Link>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${post.title}"?`))
                                    removePost.mutate(post.id);
                                }}
                                className="clay-sm inline-flex items-center gap-1 rounded-lg bg-[#f43f5e]/20 px-3 py-1.5 text-xs font-bold text-[#fda4af]"
                              >
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>

                            {campaign?.is_open && (
                              <p className="mt-3 text-[11px] font-semibold text-[#6ee7b7]">
                                Accepting applications
                              </p>
                            )}
                            {!campaign && (
                              <p className="mt-3 border-t border-white/10 pt-3 text-xs font-semibold text-[#fcd34d]">
                                No application form yet — save this announcement to create one, or
                                attach an existing registration above.
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "leaders" && (
              <div className="admin-glass mt-8 rounded-3xl p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                      Public site content
                    </p>
                    <h2 className="font-display text-2xl font-bold text-white">Club leadership</h2>
                  </div>
                  {!leaderDraft && (
                    <button
                      onClick={() =>
                        setLeaderDraft({
                          ...blankLeader,
                          display_order: Math.max(leaders.length + 1, 1),
                        })
                      }
                      className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)]"
                    >
                      <FilePlus2 className="size-4" />
                      Add leader
                    </button>
                  )}
                </div>

                {leaderDraft && (
                  <form
                    className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2"
                    onSubmit={submitLeader}
                  >
                    <div className="sm:col-span-2">
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Photo <span className="text-[#fda4af]">*</span>
                      </label>
                      <div className="mt-1.5 flex flex-wrap items-center gap-4">
                        <div className="size-24 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                          {leaderDraft.image_url ? (
                            <img
                              src={leaderDraft.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[#94a3c8]">
                              <ImagePlus className="size-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10">
                            <ImagePlus className="size-4" />
                            {leaderDraft.image_url ? "Replace photo" : "Upload photo"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={handleLeaderPhoto}
                              disabled={uploadingPhoto}
                            />
                          </label>
                          <span className="text-xs font-semibold text-[#94a3c8]">
                            {uploadingPhoto ? "Uploading…" : "PNG, JPG or WebP · max 5 MB"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Name <span className="text-[#fda4af]">*</span>
                      </label>
                      <input
                        required
                        className={fieldClass}
                        value={leaderDraft.name}
                        onChange={(e) => setLeaderDraft({ ...leaderDraft, name: e.target.value })}
                        placeholder="Yasmine Boudiaf"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Position <span className="text-[#fda4af]">*</span>
                      </label>
                      <input
                        required
                        className={fieldClass}
                        value={leaderDraft.position}
                        onChange={(e) =>
                          setLeaderDraft({ ...leaderDraft, position: e.target.value })
                        }
                        placeholder="Media Leader"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Short bio (optional)
                      </label>
                      <textarea
                        rows={3}
                        maxLength={MAX_LEADER_DESCRIPTION}
                        className={fieldClass}
                        value={leaderDraft.description}
                        onChange={(e) =>
                          setLeaderDraft({ ...leaderDraft, description: e.target.value })
                        }
                        placeholder="A one-line intro shown on the homepage carousel."
                      />
                      <p className="mt-1 text-right text-xs font-semibold text-[#94a3c8]">
                        {leaderDraft.description.length}/{MAX_LEADER_DESCRIPTION}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={saveLeader.isPending || uploadingPhoto}
                        className="clay-md inline-flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                      >
                        <Save className="size-4" />
                        {saveLeader.isPending
                          ? "Saving…"
                          : leaderDraft.id
                            ? "Save changes"
                            : "Add leader"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderDraft(null)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {leaders.length === 0 ? (
                  <p className="mt-6 font-semibold text-[#94a3c8]">
                    No leaders yet — add your first team member above.
                  </p>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {leaders.map((leader, index) => (
                      <div
                        key={leader.id}
                        className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {leader.image_url ? (
                            <img
                              src={leader.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs font-extrabold text-[#6fa0ff]">
                              {initials(leader.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-display text-lg font-bold text-white">
                              {leader.name}
                            </p>
                            <span className="rounded-full border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                              #{index + 1}
                            </span>
                          </div>
                          <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                            {leader.position}
                          </p>
                          {leader.description && (
                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#94a3c8]">
                              {leader.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => moveLeader(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${leader.name} up`}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                          <button
                            onClick={() => moveLeader(index, 1)}
                            disabled={index === leaders.length - 1}
                            aria-label={`Move ${leader.name} down`}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => setLeaderDraft(leader)}
                            aria-label={`Edit ${leader.name}`}
                            className="rounded-lg bg-[#34d399]/20 p-1.5 text-[#6ee7b7] transition-colors hover:bg-[#34d399]/30"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove "${leader.name}" from the team?`)) {
                                removeLeader.mutate(leader.id);
                              }
                            }}
                            aria-label={`Remove ${leader.name}`}
                            className="rounded-lg bg-[#f43f5e]/20 p-1.5 text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "team" && (
              <div className="admin-glass mt-8 rounded-3xl p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                      Public site content
                    </p>
                    <h2 className="font-display text-2xl font-bold text-white">
                      Mentors &amp; community
                    </h2>
                  </div>
                  {!teamDraft && (
                    <button
                      onClick={() =>
                        setTeamDraft({
                          ...blankTeam,
                          display_order: Math.max(team.length + 1, 1),
                        })
                      }
                      className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)]"
                    >
                      <FilePlus2 className="size-4" />
                      Add team member
                    </button>
                  )}
                </div>

                {teamDraft && (
                  <form
                    className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2"
                    onSubmit={submitTeam}
                  >
                    <div className="sm:col-span-2">
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Photo <span className="text-[#fda4af]">*</span>
                      </label>
                      <div className="mt-1.5 flex flex-wrap items-center gap-4">
                        <div className="size-24 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          {teamDraft.avatar_url ? (
                            <img
                              src={teamDraft.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[#94a3c8]">
                              <ImagePlus className="size-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10">
                            <ImagePlus className="size-4" />
                            {teamDraft.avatar_url ? "Replace photo" : "Upload photo"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={handleTeamPhoto}
                              disabled={teamUploading}
                            />
                          </label>
                          <span className="text-xs font-semibold text-[#94a3c8]">
                            {teamUploading ? "Uploading…" : "PNG, JPG or WebP · max 5 MB"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Name <span className="text-[#fda4af]">*</span>
                      </label>
                      <input
                        required
                        className={fieldClass}
                        value={teamDraft.name}
                        onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}
                        placeholder="Pr. Amine Cherif"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Role title <span className="text-[#fda4af]">*</span>
                      </label>
                      <input
                        required
                        className={fieldClass}
                        value={teamDraft.role_title}
                        onChange={(e) => setTeamDraft({ ...teamDraft, role_title: e.target.value })}
                        placeholder="Faculty Supervisor"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Category <span className="text-[#fda4af]">*</span>
                      </label>
                      <select
                        className={fieldClass}
                        value={teamDraft.category}
                        onChange={(e) =>
                          setTeamDraft({
                            ...teamDraft,
                            category: e.target.value as AdminTeamMember["category"],
                          })
                        }
                      >
                        {TEAM_CATEGORIES.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        LinkedIn URL (optional)
                      </label>
                      <input
                        type="url"
                        className={fieldClass}
                        value={teamDraft.linkedin_url ?? ""}
                        onChange={(e) =>
                          setTeamDraft({ ...teamDraft, linkedin_url: e.target.value })
                        }
                        placeholder="https://www.linkedin.com/in/name"
                      />
                      <p className="mt-1 text-xs font-semibold text-[#94a3c8]">
                        A valid linkedin.com profile link is required to show the icon.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={saveTeamMember.isPending || teamUploading}
                        className="clay-md inline-flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                      >
                        <Save className="size-4" />
                        {saveTeamMember.isPending
                          ? "Saving…"
                          : teamDraft.id
                            ? "Save changes"
                            : "Add team member"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeamDraft(null)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {team.length === 0 ? (
                  <p className="mt-6 font-semibold text-[#94a3c8]">
                    No mentors yet — add your first team member above.
                  </p>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {team.map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="size-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs font-extrabold text-[#6fa0ff]">
                              {initials(member.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-display text-lg font-bold text-white">
                              {member.name}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${teamCategoryTint[member.category]}`}
                            >
                              #{index + 1} · {teamCategoryLabel(member.category)}
                            </span>
                          </div>
                          <p className="truncate text-sm font-bold text-[#6fa0ff]">
                            {member.role_title}
                          </p>
                          {member.linkedin_url && (
                            <p className="mt-0.5 truncate text-xs font-semibold text-[#94a3c8]">
                              LinkedIn profile linked
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => moveTeamMember(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${member.name} up`}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                          <button
                            onClick={() => moveTeamMember(index, 1)}
                            disabled={index === team.length - 1}
                            aria-label={`Move ${member.name} down`}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => setTeamDraft(member)}
                            aria-label={`Edit ${member.name}`}
                            className="rounded-lg bg-[#34d399]/20 p-1.5 text-[#6ee7b7] transition-colors hover:bg-[#34d399]/30"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove "${member.name}" from the community section?`)) {
                                removeTeamMember.mutate(member.id);
                              }
                            }}
                            aria-label={`Remove ${member.name}`}
                            className="rounded-lg bg-[#f43f5e]/20 p-1.5 text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "admins" &&
              (canManageAdmins ? (
                <div className="admin-glass mt-8 rounded-3xl p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-bold text-white">Admins</h2>
                      <p className="mt-1 max-w-xl text-sm font-semibold text-[#94a3c8]">
                        Open an admin's Manage panel to set their section access or revoke their
                        access. Every section starts enabled (full access); turning one off hides it
                        from that admin and blocks the matching actions server-side.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                      Owner only
                    </span>
                  </div>

                  <div className="admin-glass mt-6 overflow-x-auto rounded-2xl">
                    {pendingRequests.length > 0 && (
                      <div className="mt-6 border-t border-white/10 pt-5">
                        <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                          Pending applications
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">
                          The applicant also received an accept/cancel link by email. Approving here
                          grants the role immediately.
                        </p>
                        <ul className="mt-3 space-y-2">
                          {pendingRequests.map((request) => (
                            <li
                              key={request.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">
                                  {request.name}
                                </p>
                                <p className="truncate text-xs font-semibold text-[#94a3c8]">
                                  {request.email}
                                  {request.phone ? ` · ${request.phone}` : ""} ·{" "}
                                  {prettyRole(request.role)} ·{" "}
                                  {new Date(request.created_at).toLocaleDateString("en-GB")}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    decideRequest.mutate({
                                      requestId: request.id,
                                      action: "approve",
                                    })
                                  }
                                  disabled={decideRequest.isPending}
                                  className="clay-sm inline-flex items-center gap-1 rounded-lg bg-[#34d399]/20 px-3 py-1.5 text-xs font-extrabold text-[#6ee7b7] transition hover:bg-[#34d399]/30 disabled:opacity-60"
                                >
                                  <Check className="size-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    decideRequest.mutate({
                                      requestId: request.id,
                                      action: "reject",
                                    })
                                  }
                                  disabled={decideRequest.isPending}
                                  className="clay-sm inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-extrabold text-[#94a3c8] transition hover:bg-white/10 disabled:opacity-60"
                                >
                                  <X className="size-3.5" />
                                  Reject
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Delete ${request.name}'s application for good? This cannot be undone.`,
                                      )
                                    ) {
                                      deleteRequest.mutate(request.id);
                                    }
                                  }}
                                  disabled={deleteRequest.isPending}
                                  title="Delete this application"
                                  className="clay-sm inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-extrabold text-[#64748b] transition hover:border-[#f43f5e]/40 hover:bg-[#f43f5e]/10 hover:text-[#fda4af] disabled:opacity-60"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <table className="mt-6 w-full text-sm">
                      <thead>
                        <tr className="bg-white/[0.04] text-left text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                          <th className="px-5 py-3">Name</th>
                          <th className="px-5 py-3">Email</th>
                          <th className="px-5 py-3">Role</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {admins.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-8 text-center font-semibold text-[#94a3c8]"
                            >
                              No approved admins yet.
                            </td>
                          </tr>
                        )}
                        {admins.map((admin) => {
                          const isSelfRow = admin.email === session?.email;
                          // The owner row is read-only for everyone, including
                          // a president, so don't offer a Manage button that
                          // the server would refuse.
                          const isLockedRow = isSelfRow || isOwnerRowEmail(admin.email);
                          const disabled = Boolean(admin.disabled_at);
                          return (
                            <tr
                              key={admin.user_id}
                              className={`transition-colors hover:bg-white/[0.04] ${
                                disabled ? "opacity-60" : ""
                              }`}
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar className="size-9 shrink-0">
                                    <AvatarImage src={admin.avatar_url ?? undefined} alt="" />
                                    <AvatarFallback className="bg-[#2e6bff]/25 text-xs font-bold text-white">
                                      {avatarFallback(admin.display_name, admin.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="min-w-0 truncate font-bold text-white">
                                    {admin.display_name || admin.email || "Admin"}
                                    {isSelfRow && (
                                      <span className="ml-2 rounded-full bg-[#fcd34d]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#fcd34d] uppercase">
                                        You
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 font-semibold whitespace-nowrap">
                                {admin.email ?? "—"}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="inline-block rounded-full bg-[#2e6bff]/15 px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                                  {prettyRole(admin.admin_role)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {disabled ? (
                                  <span className="inline-block rounded-full bg-[#f43f5e]/20 px-3 py-1 text-[11px] font-extrabold text-[#fda4af] uppercase">
                                    Disabled
                                  </span>
                                ) : (
                                  <span className="inline-block rounded-full bg-[#34d399] px-3 py-1 text-[11px] font-extrabold text-[#04121a] uppercase">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                {isLockedRow ? (
                                  <span className="text-xs font-semibold text-[#64748b]">
                                    {isOwnerRowEmail(admin.email) ? "Owner" : "You"}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setAdminManageId(admin.user_id)}
                                    className="clay-sm inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/25 px-3 py-2 text-xs font-bold text-[#a5c3ff] transition-colors hover:bg-[#2e6bff]/40"
                                  >
                                    <Settings2 className="size-3.5" /> Manage
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <NoAccess label="the admins page" />
              ))}
          </div>
        </main>

        {managedMember && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setManageId(null)}
            />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#081020] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#2e6bff]/40 bg-[#2e6bff]/15 text-sm font-extrabold text-[#6fa0ff]">
                    {initials(managedMember.full_name) || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-white">
                      {managedMember.full_name}
                    </p>
                    {managedMember.admin_role && (
                      <p className="text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                        {ROLE_LABELS[managedMember.admin_role] ?? managedMember.admin_role}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {isBlocked(managedMember) ? (
                        <span className="inline-block rounded-full bg-[#f43f5e]/20 px-2.5 py-0.5 text-[10px] font-extrabold text-[#fda4af] uppercase">
                          Blocked until{" "}
                          {new Date(managedMember.blocked_until as string).toLocaleDateString(
                            "en-GB",
                          )}
                        </span>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            managedMember.status === "active"
                              ? "bg-[#34d399] text-[#04121a]"
                              : "bg-[#f59e0b]/20 text-[#fcd34d]"
                          }`}
                        >
                          {managedMember.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setManageId(null)}
                  aria-label="Close member panel"
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] transition-colors hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Details
                </h3>
                <div className="mt-3 grid gap-x-6 gap-y-4 text-sm">
                  <Detail label="Email" value={managedMember.email} />
                  <Detail label="Phone" value={managedMember.phone} />
                  <Detail
                    label="Department"
                    value={
                      managedMember.speciality
                        ? `${managedMember.department} · ${managedMember.speciality}`
                        : managedMember.department
                    }
                  />
                  <Detail label="Level / school year" value={managedMember.level} />
                  {managedMember.age !== null && (
                    <Detail label="Age" value={String(managedMember.age)} />
                  )}
                  <Detail
                    label="Joined"
                    value={new Date(managedMember.created_at).toLocaleString("en-GB")}
                  />
                </div>

                <h3 className="mt-8 text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Documents on file
                </h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <MemberDocumentButton
                    label="School certificate"
                    memberId={managedMember.id}
                    document="school_certificate"
                    present={Boolean(managedMember.school_certificate_url)}
                  />
                  <MemberDocumentButton
                    label="Identification card"
                    memberId={managedMember.id}
                    document="identity_card"
                    present={Boolean(managedMember.identity_card_url)}
                  />
                </div>
                {!managedMember.school_certificate_url && !managedMember.identity_card_url && (
                  <p className="mt-3 text-xs font-semibold text-[#64748b]">
                    No documents on file — this member signed up before uploads, or was added
                    manually.
                  </p>
                )}

                <h3 className="mt-8 text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Actions
                </h3>
                <div className="mt-3 grid gap-2.5">
                  <PanelAction
                    onClick={() => setEditing(managedMember)}
                    className="border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#fcd34d] hover:bg-[#f59e0b]/20"
                  >
                    <Pencil className="size-4" /> Edit details
                  </PanelAction>
                  {isBlocked(managedMember) ? (
                    <PanelAction
                      onClick={() => setBlockTarget(managedMember)}
                      className="border-[#34d399]/30 bg-[#34d399]/10 text-[#6ee7b7] hover:bg-[#34d399]/20"
                    >
                      <UserCheck className="size-4" /> Unblock
                    </PanelAction>
                  ) : (
                    <PanelAction
                      onClick={() => {
                        setBlockOption("1w");
                        setCustomUntil("");
                        setBlockTarget(managedMember);
                      }}
                      className="border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#fda4af] hover:bg-[#f43f5e]/20"
                    >
                      <Ban className="size-4" /> Block
                    </PanelAction>
                  )}
                  <PanelAction
                    onClick={() => setRemoveConfirm(managedMember)}
                    className="border-[#f43f5e]/40 bg-[#f43f5e]/15 text-[#fda4af] hover:bg-[#f43f5e]/30"
                  >
                    <Trash2 className="size-4" /> Remove member
                  </PanelAction>
                </div>
              </div>
            </aside>
          </>
        )}

        {managedAdmin && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setAdminManageId(null)}
            />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#081020] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="size-12 shrink-0">
                    <AvatarImage src={managedAdmin.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-[#2e6bff]/25 text-sm font-extrabold text-white">
                      {avatarFallback(managedAdmin.display_name, managedAdmin.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-white">
                      {managedAdmin.display_name || managedAdmin.email || "Admin"}
                    </p>
                    {managedAdmin.admin_role && (
                      <p className="text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                        {prettyRole(managedAdmin.admin_role)}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {managedAdmin.disabled_at ? (
                        <span className="inline-block rounded-full bg-[#f43f5e]/20 px-2.5 py-0.5 text-[10px] font-extrabold text-[#fda4af] uppercase">
                          Disabled
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-[#34d399] px-2.5 py-0.5 text-[10px] font-extrabold text-[#04121a] uppercase">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAdminManageId(null)}
                  aria-label="Close admin panel"
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] transition-colors hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Details
                </h3>
                <div className="mt-3 grid gap-x-6 gap-y-4 text-sm">
                  <Detail label="Email" value={managedAdmin.email ?? "—"} />
                  <Detail
                    label="Role"
                    value={managedAdmin.admin_role ? prettyRole(managedAdmin.admin_role) : "Admin"}
                  />
                  <Detail label="Department" value={managedAdmin.department ?? "—"} />
                  <Detail label="Level" value={managedAdmin.level ?? "—"} />
                  <Detail
                    label="Approved"
                    value={
                      managedAdmin.created_at
                        ? new Date(managedAdmin.created_at).toLocaleString("en-GB")
                        : "—"
                    }
                  />
                </div>

                <h3 className="mt-8 text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Section access
                </h3>
                <p className="mt-1 text-xs font-semibold text-[#64748b]">
                  Turn a section off to hide it from this admin and block the matching actions
                  server-side.
                </p>
                <div className="mt-3 grid gap-2">
                  {ADMIN_SECTIONS.filter((section) => section !== "registrations").map(
                    (section) => {
                      // "registrations" is the legacy twin of "events" and is
                      // written in lockstep, so one switch covers both.
                      const allowed =
                        section === "events"
                          ? !managedAdmin.restricted.includes("events") &&
                            !managedAdmin.restricted.includes("registrations")
                          : !managedAdmin.restricted.includes(section);
                      return (
                        <div
                          key={section}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                        >
                          <p className="text-sm font-bold text-white">
                            {adminSectionLabel(section)}
                          </p>
                          <Switch
                            checked={allowed}
                            disabled={toggleSection.isPending}
                            aria-label={`${adminSectionLabel(section)} access for ${
                              managedAdmin.display_name || managedAdmin.email
                            }`}
                            onCheckedChange={() =>
                              toggleSection.mutate({
                                adminId: managedAdmin.user_id,
                                section,
                                allowed: !allowed,
                              })
                            }
                            className="data-[state=checked]:bg-[#2e6bff]"
                          />
                        </div>
                      );
                    },
                  )}
                </div>

                <h3 className="mt-8 text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  Admin actions
                </h3>
                <div className="mt-3 grid gap-2.5">
                  {managedAdmin.disabled_at ? (
                    <PanelAction
                      onClick={() =>
                        toggleDisabled.mutate({
                          adminId: managedAdmin.user_id,
                          disabled: false,
                        })
                      }
                      className="border-[#34d399]/30 bg-[#34d399]/10 text-[#6ee7b7] hover:bg-[#34d399]/20"
                    >
                      <UserCheck className="size-4" /> Restore admin access
                    </PanelAction>
                  ) : (
                    <PanelAction
                      onClick={() => setDisableTarget(managedAdmin)}
                      className="border-[#f43f5e]/40 bg-[#f43f5e]/15 text-[#fda4af] hover:bg-[#f43f5e]/30"
                    >
                      <Trash2 className="size-4" /> Revoke admin access
                    </PanelAction>
                  )}
                  {canManageAdmins && managedAdmin.user_id !== session?.email && (
                    <PanelAction
                      onClick={() => sendInvite.mutate({ adminId: managedAdmin.user_id })}
                      className="border-[#2e6bff]/40 bg-[#2e6bff]/15 text-[#a5c3ff] hover:bg-[#2e6bff]/30"
                    >
                      <Send className="size-4" />
                      {sendInvite.isPending ? "Creating link…" : "Send / resend invite link"}
                    </PanelAction>
                  )}
                  {canManageAdmins && !isOwnerRowEmail(managedAdmin.email) && (
                    <PanelAction
                      onClick={() => setDeleteTarget(managedAdmin)}
                      className="border-[#f43f5e]/40 bg-transparent text-[#fda4af] hover:bg-[#f43f5e]/15"
                    >
                      <Trash2 className="size-4" /> Delete admin permanently
                    </PanelAction>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-semibold text-[#64748b]">
                  Revoking keeps the account and can be undone. Deleting removes the officer role
                  for good — the person keeps their member record, but only a new application can
                  grant admin again.
                </p>
              </div>
            </aside>
          </>
        )}

        {inviteLink && (
          <div className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-3rem)] max-w-xl -translate-x-1/2 rounded-3xl border border-[#2e6bff]/40 bg-[#0a1226] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white">
                  Set-password link for {inviteLink.email}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#94a3c8]">
                  Email is not delivering yet. Copy this and send it to them over Telegram,
                  WhatsApp, or in person. It works once.
                </p>
              </div>
              <button
                onClick={() => setInviteLink(null)}
                aria-label="Dismiss invite link"
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] transition-colors hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <code className="mt-3 block max-h-24 overflow-y-auto break-all rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] font-semibold text-[#a5c3ff]">
              {inviteLink.link}
            </code>
            <button
              onClick={() => void copyInvite()}
              className="clay-sm mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/30 px-3 py-2 text-xs font-bold text-[#a5c3ff] transition-colors hover:bg-[#2e6bff]/45"
            >
              {inviteCopied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm">
            <div className="admin-glass-strong w-full max-w-lg overflow-y-auto rounded-3xl p-7">
              <h2 className="font-display text-xl font-bold text-white">Edit member</h2>
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
                    value={editing.age ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        age: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
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
                    value={editing.speciality ?? ""}
                    onChange={(e) => setEditing({ ...editing, speciality: e.target.value })}
                  >
                    <option value="">Not specified</option>
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
                    className="clay-md rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {blockTarget && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm">
            <div className="admin-glass-strong w-full max-w-md overflow-y-auto rounded-3xl p-7">
              {isBlocked(blockTarget) ? (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Unblock member</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    {blockTarget.full_name} is currently blocked until{" "}
                    <span className="text-[#6ee7b7]">
                      {new Date(blockTarget.blocked_until as string).toLocaleString("en-GB")}
                    </span>
                    . They will be able to join the club again as soon as you unblock them.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => unblockMember.mutate(blockTarget.id)}
                      disabled={unblockMember.isPending}
                      className="clay-md rounded-2xl bg-[#34d399] px-6 py-3 font-bold text-[#04121a] shadow-[0_14px_38px_-16px_rgba(52,211,153,0.6)] disabled:opacity-70"
                    >
                      Unblock now
                    </button>
                    <button
                      onClick={() => setBlockTarget(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Block member</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    Blocking {blockTarget.full_name} will mark them as blocked in the club until the
                    date you choose. This won't delete any of their data.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {(["1w", "2w", "1m", "3m"] as const).map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white"
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
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white">
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
                      className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                    >
                      {blockMember.isPending ? "Blocking…" : "Block member"}
                    </button>
                    <button
                      onClick={() => setBlockTarget(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {removeConfirm && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm">
            <div className="admin-glass-strong w-full max-w-md rounded-3xl p-7">
              <h2 className="font-display text-xl font-bold text-white">Remove member</h2>
              <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                Remove <span className="text-white">{removeConfirm.full_name}</span> from the club?
                This deletes their member record and can't be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => removeMember.mutate(removeConfirm.id)}
                  disabled={removeMember.isPending}
                  className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                >
                  {removeMember.isPending ? "Removing…" : "Remove member"}
                </button>
                <button
                  onClick={() => setRemoveConfirm(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {profileOpen && (
          <Dialog open onOpenChange={(open) => !open && setProfileOpen(false)}>
            <DialogContent className="border-white/10 bg-[#0a1226] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">My profile</DialogTitle>
                <DialogDescription className="font-semibold text-[#94a3c8]">
                  Set the name and photo shown to other club officers.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitProfile} className="space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar className="size-16">
                    <AvatarImage src={profileAvatar ?? undefined} alt="" />
                    <AvatarFallback className="bg-[#2e6bff]/25 font-display text-xl font-bold text-white">
                      {avatarFallback(profileName, session?.email ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                      Profile photo
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-4 py-2.5 text-sm font-bold text-[#6fa0ff] transition-colors hover:bg-[#2e6bff]/25">
                      <ImagePlus className="size-4" />
                      {profileUploading ? "Uploading…" : "Upload new photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleProfilePhoto}
                      />
                    </label>
                    <p className="mt-1.5 text-[11px] font-semibold text-[#64748b]">
                      PNG, JPG or WebP · max 5 MB
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-display-name"
                    className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase"
                  >
                    Display name
                  </label>
                  <input
                    id="profile-display-name"
                    className={`${fieldClass} mt-1.5`}
                    value={profileName}
                    maxLength={60}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={session?.email ?? "Your name"}
                  />
                </div>

                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveProfile.isPending}
                    className="clay-md rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                  >
                    {saveProfile.isPending ? "Saving…" : "Save profile"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {disableTarget && (
          <Dialog open onOpenChange={(open) => !open && setDisableTarget(null)}>
            <DialogContent className="border-white/10 bg-[#0a1226] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Revoke admin access</DialogTitle>
                <DialogDescription className="font-semibold text-[#94a3c8]">
                  {disableTarget.display_name || disableTarget.email} keeps their profile and member
                  record but immediately loses admin access until you restore it. Their account is
                  not deleted and their section permissions are kept.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  onClick={() => setDisableTarget(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    toggleDisabled.mutate({ adminId: disableTarget.user_id, disabled: true })
                  }
                  disabled={toggleDisabled.isPending}
                  className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                >
                  {toggleDisabled.isPending ? "Revoking…" : "Revoke admin access"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {deleteTarget && (
          <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <DialogContent className="border-white/10 bg-[#0a1226] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Delete admin permanently</DialogTitle>
                <DialogDescription className="font-semibold text-[#94a3c8]">
                  {deleteTarget.display_name || deleteTarget.email} loses their officer role and all
                  admin access immediately. Their login and member record are kept, and their
                  application is closed so it cannot be restored by a later sign-in — only a new
                  application can grant admin again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteOfficer.mutate({ adminId: deleteTarget.user_id })}
                  disabled={deleteOfficer.isPending}
                  className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                >
                  {deleteOfficer.isPending ? "Deleting…" : "Delete admin"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </ShadTooltipProvider>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">{label}</p>
      <p className="mt-0.5 font-semibold break-words text-white">{value || "—"}</p>
    </div>
  );
}

function PanelAction({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function MemberDocumentButton({
  label,
  memberId,
  document,
  present,
}: {
  label: string;
  memberId: string;
  document: MemberDocumentKey;
  present: boolean;
}) {
  const view = useMutation({
    mutationFn: () => getMemberDocumentUrl({ data: { memberId, document } }),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => toast.error(error.message ?? "Could not open the document"),
  });

  if (!present) {
    return (
      <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#64748b]">
        {label}: not provided
      </span>
    );
  }

  return (
    <button
      onClick={() => view.mutate()}
      disabled={view.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/20 px-3 py-2 text-xs font-bold text-[#6fa0ff] transition-colors hover:bg-[#2e6bff]/30 disabled:opacity-70"
    >
      <Eye className="size-3.5" />
      {view.isPending ? "Loading…" : label}
    </button>
  );
}

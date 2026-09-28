// Announcements — the single domain vocabulary shared by the public feed
// (src/routes/index.tsx → `SubmissionAnnouncementCard`) and the admin console
// (src/routes/_authenticated/gestion.admin.tsx → `src/lib/admin-api.ts`).
//
// The `event` / `news` announcement types are retired (migration 0016). The only
// kind left is `registration`: an announcement whose whole job is to tell a
// student that a submission is open. `submission_type` says *which* submission.

/** The only announcement kind that exists in the database. */
export const ANNOUNCEMENT_KIND = "registration" as const;

/** What an announcement is asking students to submit to. */
export const SUBMISSION_TYPES = ["openday", "event"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

/** Narrow an untrusted value (form input, JSON row) to a `SubmissionType`. */
export function isSubmissionType(value: unknown): value is SubmissionType {
  return typeof value === "string" && (SUBMISSION_TYPES as readonly string[]).includes(value);
}

/** Short name — admin pills, dropdowns, analytics legends. */
export const SUBMISSION_TYPE_LABEL: Record<SubmissionType, string> = {
  openday: "Open day",
  event: "Event",
};

/** Full card eyebrow — answers "what is this, exactly?" before the title is read. */
export const SUBMISSION_TYPE_KIND_LABEL: Record<SubmissionType, string> = {
  openday: "Submission for open day",
  event: "Submission for event",
};

/** One-line helper shown under the eyebrow in the admin form. */
export const SUBMISSION_TYPE_HINT: Record<SubmissionType, string> = {
  openday: "Students come to meet the club, tour the labs and register for a full membership.",
  event: "Students sign up to take part in one specific club event or workshop.",
};

/** A row in the announcements feed (public columns). */
export type SubmissionAnnouncement = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  location: string | null;
  event_date: string | null;
  submission_type: SubmissionType;
  is_pinned: boolean;
  created_at: string;
};

/**
 * Feed order: pinned first, then newest. Applied client-side too so the public
 * card list stays correct even if a caller forgets the `order` clause.
 */
export function sortAnnouncements<T extends { is_pinned: boolean; created_at: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at),
  );
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** True from now until 7 days after `value`. */
export function isUpcomingSoon(value: string | null | undefined): boolean {
  const time = parseDate(value);
  if (time === null) return false;
  const diff = time - Date.now();
  return diff >= 0 && diff <= 7 * MS_PER_DAY;
}

/** "Today" / "Tomorrow" / "In 5 days" for a date inside the next week, else null. */
export function countdownLabel(value: string | null | undefined): string | null {
  const time = parseDate(value);
  if (time === null) return null;
  const diff = time - Date.now();
  if (diff < 0 || diff > 7 * MS_PER_DAY) return null;
  const days = Math.ceil(diff / MS_PER_DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Long-form date for the card meta row — day, month, year, 24h time. */
export function formatEventDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

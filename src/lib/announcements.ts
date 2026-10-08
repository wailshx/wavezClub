// Announcements — the single domain vocabulary shared by the public feed
// (src/routes/index.tsx → `SubmissionAnnouncementCard`) and the admin console
// (src/routes/_authenticated/gestion.admin.tsx → `src/lib/admin-api.ts`).
//
// The `event` / `news` announcement types are retired (migration 0016). The only
// kind left is `registration`, and `submission_type` is what actually describes
// the row now that one announcement can move through a lifecycle (migration
// 0022): a submission that is open, a teaser for one that is not, or plain
// information with no form at all.
//
// For the two submission types an announcement is also the entry point to
// registration (migration 0017): its "Submit" button reveals the application
// form *inside the card*, and the ONE campaign it announces drives which form
// that is. There is no separate registration page and no shared `#join`
// campaign list any more — two announcements pointing at one undifferentiated
// form would have hidden the difference between an open-day membership drive
// (documents required) and an event sign-up (none).

import type { CampaignKind } from "@/lib/registrations";

/** The only announcement kind that exists in the database. */
export const ANNOUNCEMENT_KIND = "registration" as const;

/**
 * The four shapes an announcement can take (migration 0022).
 *
 * The first two are submissions — they drive a campaign and show a form. The
 * other two deliberately do not: `announcement` is information only, `soon` is
 * a teaser that may name the day it opens.
 */
export const SUBMISSION_TYPES = ["openday", "event", "announcement", "soon"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

/** The two types that drive a registration form. */
export const OPEN_SUBMISSION_TYPES = ["openday", "event"] as const;

/** True only for the two types that submit to a campaign. */
export function isOpenSubmissionType(
  value: unknown,
): value is Extract<SubmissionType, "openday" | "event"> {
  return value === "openday" || value === "event";
}

/** Narrow an untrusted value (form input, JSON row) to a `SubmissionType`. */
export function isSubmissionType(value: unknown): value is SubmissionType {
  return typeof value === "string" && (SUBMISSION_TYPES as readonly string[]).includes(value);
}

/**
 * The campaign kind an announcement type is allowed to point at.
 *
 * This is the invariant that keeps the two flows honest: an "open day"
 * announcement can only drive a membership campaign (3-step wizard, document
 * uploads) and an "event" announcement only an event campaign (single-step
 * form). `announcement` and `soon` carry no form at all — `null` means "must
 * not be attached to a campaign" and is re-checked in `savePost`.
 */
export const CAMPAIGN_KIND_FOR_SUBMISSION: Record<SubmissionType, CampaignKind | null> = {
  openday: "membership",
  event: "event",
  announcement: null,
  soon: null,
};

/** Short name — admin pills, dropdowns, analytics legends. */
export const SUBMISSION_TYPE_LABEL: Record<SubmissionType, string> = {
  openday: "Open day",
  event: "Event",
  announcement: "Announcement",
  soon: "Opening soon",
};

/** Full card eyebrow — answers "what is this, exactly?" before the title is read. */
export const SUBMISSION_TYPE_KIND_LABEL: Record<SubmissionType, string> = {
  openday: "Submission for open day",
  event: "Submission for event",
  announcement: "Announcement",
  soon: "Registration opening soon",
};

/** One-line helper shown under the eyebrow in the admin form. */
export const SUBMISSION_TYPE_HINT: Record<SubmissionType, string> = {
  openday: "Students come to meet the club, tour the labs and register for a full membership.",
  event: "Students sign up to take part in one specific club event or workshop.",
  announcement: "Information only — no form, no call to action.",
  soon: "Teaser card with an optional opening date; the form comes later.",
};

/**
 * The card's call to action. Both reveal the form in place, but the wording has
 * to match what they are actually applying for. The two non-submission types
 * never render a CTA, so their entries exist only to complete the record.
 */
export const SUBMISSION_CTA_LABEL: Record<SubmissionType, string> = {
  openday: "Submit your application",
  event: "Register for this event",
  announcement: "",
  soon: "",
};

/**
 * The trust line beside the CTA. Sets the right expectation per flow: the
 * membership wizard asks for two uploaded documents, the event form does not.
 */
export const SUBMISSION_CTA_NOTE: Record<SubmissionType, string> = {
  openday: "About 5 minutes — you'll attach your school certificate and ID card.",
  event: "About 2 minutes — just your details, no documents needed.",
  announcement: "",
  soon: "",
};

/**
 * Shown in place of the button when the announcement has no campaign linked, or
 * its campaign is closed. The form could be opened, but RLS only accepts the
 * insert while the campaign is open, so the card says so up front instead of
 * letting the student fill everything in only to fail on submit.
 */
export const SUBMISSION_CTA_CLOSED_LABEL = "Registration opening soon";
export const SUBMISSION_CTA_CLOSED_NOTE =
  "This submission isn't accepting entries yet — check back shortly.";

/** A row in the announcements feed (public columns). */
export type SubmissionAnnouncement = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  location: string | null;
  event_date: string | null;
  submission_type: SubmissionType;
  /** Teaser date for the `soon` type — null for every other announcement. */
  opens_at: string | null;
  is_pinned: boolean;
  created_at: string;
  /** Campaign this announcement drives, or null when none is linked yet. */
  campaign_id: string | null;
};

/**
 * Feed band, low numbers first: the two submission types are what a student
 * can act on right now, `soon` is what they should watch for, and a plain
 * announcement is background information.
 */
export function announcementBand(type: SubmissionType): 0 | 1 | 2 {
  if (isOpenSubmissionType(type)) return 0;
  if (type === "soon") return 1;
  return 2;
}

/**
 * Feed order: open submissions first, then "opening soon", then information
 * announcements — pinned first and newest first inside each band. Applied
 * client-side too so the public card list stays correct even if a caller
 * forgets the `order` clause.
 */
export function sortAnnouncements<
  T extends { submission_type: SubmissionType; is_pinned: boolean; created_at: string },
>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      announcementBand(a.submission_type) - announcementBand(b.submission_type) ||
      Number(b.is_pinned) - Number(a.is_pinned) ||
      b.created_at.localeCompare(a.created_at),
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

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Compass,
  Hourglass,
  MapPin,
  Megaphone,
  Pin,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ScrollReveal } from "@/components/scroll-reveal";
import { PulseDot } from "@/components/pulse-dot";
import { SubmissionApplicationForm } from "@/components/submission-application-form";
import {
  SUBMISSION_CTA_CLOSED_LABEL,
  SUBMISSION_CTA_CLOSED_NOTE,
  SUBMISSION_CTA_LABEL,
  SUBMISSION_CTA_NOTE,
  SUBMISSION_TYPE_KIND_LABEL,
  countdownLabel,
  formatEventDate,
  isOpenSubmissionType,
  type SubmissionAnnouncement,
  type SubmissionType,
} from "@/lib/announcements";
import type { OpenCampaign } from "@/lib/registrations";

/**
 * Visual identity per announcement type. Open day reads brand-blue, event reads
 * teal, plain information lilac, teaser amber — the card is recognisable from
 * the corner alone, before a word is read.
 */
const SUBMISSION_STYLE: Record<
  SubmissionType,
  { Icon: LucideIcon; pill: string; pin: string; hairline: string; wash: string }
> = {
  openday: {
    Icon: Compass,
    pill: "bg-brand/15 text-brand-deep",
    pin: "bg-brand text-primary-foreground shadow-[0_12px_24px_-10px_rgba(37,99,235,0.9)]",
    hairline: "bg-linear-to-r from-brand via-cyan-400 to-transparent",
    wash: "from-brand/12 via-cyan-400/8",
  },
  event: {
    Icon: CalendarClock,
    pill: "bg-mint/25 text-mint-foreground",
    pin: "bg-mint-foreground text-white shadow-[0_12px_24px_-10px_rgba(14,116,144,0.9)]",
    hairline: "bg-linear-to-r from-mint via-brand to-transparent",
    wash: "from-mint/16 via-brand/8",
  },
  announcement: {
    Icon: Megaphone,
    pill: "bg-lilac/20 text-lilac-foreground",
    pin: "bg-lilac-foreground text-white shadow-[0_12px_24px_-10px_rgba(99,102,241,0.9)]",
    hairline: "bg-linear-to-r from-lilac via-brand to-transparent",
    wash: "from-lilac/15 via-brand/8",
  },
  soon: {
    Icon: Hourglass,
    pill: "bg-lemon/25 text-lemon-foreground",
    pin: "bg-lemon-foreground text-white shadow-[0_12px_24px_-10px_rgba(217,119,6,0.9)]",
    hairline: "bg-linear-to-r from-lemon via-brand to-transparent",
    wash: "from-lemon/15 via-brand/8",
  },
};

/** "Today" / "Tomorrow" / "In 5 days" — only while the date is inside a week. */
function UrgencyChip({ eventDate }: { eventDate: string }) {
  const label = countdownLabel(eventDate);
  if (!label) return null;
  const isNow = label === "Today" || label === "Tomorrow";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold tracking-widest uppercase ${
        isNow ? "bg-brand-deep text-background" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {isNow && <PulseDot tone="inverse" />}
      {label}
    </span>
  );
}

/**
 * The card itself, without any entrance animation.
 *
 * Design contract, top to bottom:
 *  · the **pin** sits in the top-left, and that corner is deliberately left
 *    square so the pin reads as driven *into* the surface rather than floating;
 *  · a type eyebrow ("Submission for open day" / "… for event" / "Announcement" /
 *    "Registration opening soon") answers "what is this?" before the title is read;
 *  · title → subtitle → body descend in size and weight, so the eye lands on the
 *    title first, the promise second, the detail last;
 *  · one CTA that opens the application form *inside this card*, plus a trust line.
 *    Only the submission types get that far: a `soon` teaser ends in a calm
 *    "Registration opening soon" with its opening date, and a plain announcement
 *    ends after the body — neither is ever clickable.
 *
 * The application lives in the card: there is no separate registration page.
 * The CTA reveals the form in place, and the campaign decides what that form is —
 * the membership wizard (profile, two uploads, questions) or the single-step event
 * form. When the campaign is missing or closed the button is replaced by a plain
 * note, because a link into a closed registration is worse than no link.
 *
 * `preview` drops the CTA (a draft must not look clickable) and inherits the
 * caller's colour tokens, so the admin console can render it live.
 */
function AnnouncementCard({
  announcement,
  campaign,
  preview,
}: {
  announcement: SubmissionAnnouncement;
  /** Open campaign this card applies to, or null when it isn't accepting. */
  campaign: OpenCampaign | null;
  preview: boolean;
}) {
  const style = SUBMISSION_STYLE[announcement.submission_type] ?? SUBMISSION_STYLE.openday;
  const TypeIcon = style.Icon;
  const { title, subtitle, body, location, event_date, opens_at, is_pinned } = announcement;
  const type = announcement.submission_type;
  // Only the two submission types ever show a form. `announcement` and `soon`
  // ignore any campaign still linked to them — a teaser must not smuggle in an
  // application the admin already closed off.
  const isSubmission = isOpenSubmissionType(type);
  const formCampaign = isSubmission ? campaign : null;

  const [applying, setApplying] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // The form appears below the fold on a long card, so bring it into view rather
  // than leaving the student staring at the button they just pressed.
  useEffect(() => {
    if (!applying) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [applying]);

  return (
    // Wrapper carries the hover treatment so the card can stay `overflow-hidden`
    // without clipping `.hover-glow`'s pseudo-element.
    <div className="group hover-glow transition-transform duration-200 ease-out hover:pointer-fine:-translate-y-1">
      <article className="relative isolate overflow-hidden rounded-tr-[2.75rem] rounded-br-[2.75rem] rounded-bl-[2.75rem] border border-brand/20 bg-card shadow-sm">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-linear-to-br ${style.wash} to-transparent`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${style.hairline}`}
        />

        <div className="relative p-6 md:p-10">
          {/* ── Pin (top-left) · type eyebrow · urgency ─────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span
              aria-hidden="true"
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${style.pin} -ml-1 -mt-1`}
            >
              <Pin className="size-6 -rotate-[20deg]" strokeWidth={2.5} />
            </span>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.16em] uppercase ${style.pill}`}
            >
              <TypeIcon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
              {SUBMISSION_TYPE_KIND_LABEL[announcement.submission_type]}
            </span>

            {event_date && <UrgencyChip eventDate={event_date} />}
            {type === "soon" && opens_at && <UrgencyChip eventDate={opens_at} />}

            {is_pinned && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 px-3.5 py-1.5 text-[11px] font-extrabold tracking-widest text-brand uppercase md:ml-auto">
                <Pin aria-hidden="true" className="size-3 -rotate-[20deg]" strokeWidth={2.5} />
                Pinned to top
              </span>
            )}
          </div>

          {/* ── Title → subtitle ──────────────────────────────────────────── */}
          <h3 className="mt-7 max-w-4xl font-display text-[1.75rem] leading-[1.04] font-bold tracking-tight break-words text-pretty text-brand-deep transition-colors duration-200 group-hover:text-brand md:text-[2.75rem]">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-3.5 max-w-2xl text-[1.0625rem] leading-snug font-semibold break-words text-pretty text-foreground/80 md:text-[1.375rem]">
              {subtitle}
            </p>
          )}

          {/* ── When / where ──────────────────────────────────────────────── */}
          {(event_date || location || (type === "soon" && opens_at)) && (
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2.5 border-y border-foreground/10 py-4">
              {event_date && (
                <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground/70">
                  <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand" />
                  {formatEventDate(event_date)}
                </span>
              )}
              {type === "soon" && opens_at && (
                <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground/70">
                  <Hourglass aria-hidden="true" className="size-4 shrink-0 text-lemon-foreground" />
                  Opens {formatEventDate(opens_at)}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-2 text-sm font-bold break-words text-foreground/70">
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand" />
                  {location}
                </span>
              )}
            </div>
          )}

          {body && (
            <p className="mt-6 max-w-3xl text-[15px] leading-relaxed font-semibold break-words whitespace-pre-line text-pretty text-muted-foreground md:text-base">
              {body}
            </p>
          )}

          {/* ── Apply from this card (skipped in the admin preview) ─────── */}
          {isSubmission && !preview && (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {formCampaign ? (
                applying ? (
                  <button
                    type="button"
                    onClick={() => setApplying(false)}
                    aria-expanded
                    className="clay-md inline-flex items-center gap-2.5 rounded-2xl border border-foreground/15 bg-card px-6 py-3.5 text-base font-bold text-brand-deep"
                  >
                    <X aria-hidden="true" className="size-5" />
                    Close application
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setApplying(true)}
                      aria-expanded={false}
                      className="cta-pulse clay-md inline-flex items-center gap-2.5 rounded-2xl bg-brand px-8 py-4 text-base font-bold text-primary-foreground transition-transform duration-200 hover:pointer-fine:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 md:text-lg"
                    >
                      {SUBMISSION_CTA_LABEL[type]}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </button>
                    <p className="text-sm font-bold text-muted-foreground">
                      {SUBMISSION_CTA_NOTE[type]}
                    </p>
                  </>
                )
              ) : (
                <>
                  {/* Deliberately not a button — see the component docblock. */}
                  <span className="inline-flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-foreground/20 px-8 py-4 text-base font-bold text-muted-foreground md:text-lg">
                    {SUBMISSION_CTA_CLOSED_LABEL}
                  </span>
                  <p className="text-sm font-bold text-muted-foreground">
                    {SUBMISSION_CTA_CLOSED_NOTE}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Teaser tail: a calm "not yet", never a form ───────────────── */}
          {!isSubmission && type === "soon" && (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="inline-flex items-center gap-2.5 rounded-2xl border border-foreground/15 bg-secondary px-6 py-3.5 text-base font-bold text-secondary-foreground md:text-lg">
                <Hourglass aria-hidden="true" className="size-5 text-lemon-foreground" />
                Registration opening soon
              </span>
              {opens_at && (
                <p className="text-sm font-bold text-muted-foreground">
                  The application form appears here on {formatEventDate(opens_at)}.
                </p>
              )}
            </div>
          )}

          {/* ── The application itself, in place ──────────────────────────── */}
          {!preview && applying && formCampaign && (
            <div ref={formRef} className="mt-6">
              <SubmissionApplicationForm
                campaign={formCampaign}
                onClose={() => setApplying(false)}
              />
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export function SubmissionAnnouncementCard({
  announcement,
  index,
  campaign,
  preview = false,
}: {
  announcement: SubmissionAnnouncement;
  /** Position in the feed — only used to stagger the entrance. */
  index: number;
  /**
   * The announcement's campaign, resolved against the *open* campaign list by
   * the caller: pass null when the link is missing or the campaign has closed,
   * and the card renders a non-clickable state instead of a dead application.
   */
  campaign?: OpenCampaign | null;
  /** Render inside the admin console: no entrance animation, no CTA. */
  preview?: boolean;
}) {
  // The preview is usually below the fold of a long form, so it must never be
  // gated behind a scroll-triggered reveal.
  if (preview) return <AnnouncementCard announcement={announcement} campaign={null} preview />;

  return (
    <ScrollReveal delay={Math.min(0.08 * index, 0.24)} scale>
      <AnnouncementCard announcement={announcement} campaign={campaign ?? null} preview={false} />
    </ScrollReveal>
  );
}

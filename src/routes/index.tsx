import { ArrowRight } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OpenCampaign } from "@/lib/registrations";
import {
  sortAnnouncements,
  type SubmissionAnnouncement,
  type SubmissionType,
} from "@/lib/announcements";
import { BoltDivider } from "@/components/circuit-board";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SubmissionAnnouncementCard } from "@/components/submission-announcement-card";
import { LeadersCarousel } from "@/components/leaders-carousel";
import { MentorsSection } from "@/components/mentors-section";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import facultyLogo from "@/assets/faculty-logo.png";
import heroPhoto from "@/assets/hero-photo.png";
import aboutPhoto from "@/assets/about-photo.jpg";
import wavezLogoMark from "@/assets/wavez-logo-mark.png";
import { fetchPublicLeaders } from "@/lib/leaders";
import { fetchPublicTeamMembers } from "@/lib/team";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wavez Club — Ride the wave. Build the future." },
      {
        name: "description",
        content:
          "Wavez Club at the Faculty of Electrical Engineering, Djillali Liabès University of Sidi Bel Abbès: electronics, robotics, AI, embedded systems and IoT.",
      },
      { property: "og:title", content: "Wavez Club — Ride the wave. Build the future." },
      {
        property: "og:description",
        content:
          "A student-led scientific community turning engineering theory into real projects, workshops and competitions.",
      },
    ],
  }),
  component: Index,
});

/** Coerce a raw `posts` row (typed as `text`) into the feed's domain shape. */
function toAnnouncement(row: {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  location: string | null;
  event_date: string | null;
  submission_type: string;
  is_pinned: boolean;
  created_at: string;
  campaign_id: string | null;
}): SubmissionAnnouncement {
  return {
    ...row,
    submission_type: (row.submission_type === "event" ? "event" : "openday") as SubmissionType,
  };
}

function Index() {
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["public-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, title, subtitle, body, location, event_date, submission_type, is_pinned, created_at, campaign_id",
        )
        .eq("published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) throw error;
      return ((data ?? []) as unknown as Parameters<typeof toAnnouncement>[0][]).map(
        toAnnouncement,
      );
    },
  });

  const { data: leaders = [] } = useQuery({
    queryKey: ["public-leaders"],
    queryFn: () => fetchPublicLeaders(supabase),
  });

  const { data: team = [] } = useQuery({
    queryKey: ["public-team"],
    queryFn: () => fetchPublicTeamMembers(supabase),
  });

  // The open-campaign list is no longer rendered as its own section. It is still
  // needed here, as the single source of truth for "is this announcement's
  // submission actually accepting entries?" — `list_open_campaigns` already
  // filters on `is_open`, so membership of this map IS the open check. The whole
  // campaign is handed to the card, not just its id, because the card now renders
  // the application form in place and needs the questions and document rules.
  const { data: openCampaigns = [] } = useQuery({
    queryKey: ["open-campaigns"],
    queryFn: async () => {
      const rpc = supabase as unknown as {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await rpc.rpc("list_open_campaigns");
      if (error) throw error;
      return (data ?? []) as OpenCampaign[];
    },
  });

  const openCampaignsById = new Map(openCampaigns.map((campaign) => [campaign.id, campaign]));

  // Feed order: pinned announcements first, then newest.
  const announcements = sortAnnouncements(posts);

  return (
    <div className="min-h-screen scroll-smooth bg-background">
      <SiteHeader />

      <section className="hero-stage relative overflow-hidden">
        <div aria-hidden="true" className="hero-orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
          <span className="hero-orb hero-orb--c" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pt-12 pb-16 md:min-h-[560px] md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-14 md:pt-8 md:pb-20">
          {/* Text — sits directly on the page, no boxed card */}
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
              Faculty of Electrical Engineering · Djillali Liabès University, Sidi Bel Abbès
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-bold md:text-7xl">
              Ride the wave. Build the future.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold text-foreground/75">
              Wavez Club is a student-led scientific and technological community bringing together
              students passionate about electronics, electrical engineering, automation, artificial
              intelligence, robotics, embedded systems and IoT.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              {/* Registration is per-announcement now (each card submits to its own
                  campaign), so the hero points at the feed instead of a shared
                  campaign list that no longer exists. */}
              <a
                href="#submissions"
                className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                See open submissions
              </a>
              <Link
                to="/about"
                className="rounded-2xl border-2 border-brand/25 bg-card/60 px-7 py-3.5 font-bold text-brand-deep transition-colors hover:border-brand/60 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Learn about Wavez Club
              </Link>
            </div>
          </div>

          {/* Image — asymmetric corner radius (top-left + bottom-right), not a uniform box */}
          <div className="animate-rise relative [animation-delay:150ms]">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-tl-[6rem] rounded-br-[6rem] bg-linear-to-br from-brand/30 via-cyan-400/20 to-transparent blur-2xl"
            />
            <img
              src={heroPhoto}
              alt="Wavez Club students working on electronics and robotics projects"
              className="relative aspect-[16/10] w-full rounded-tl-[6rem] rounded-br-[6rem] bg-card object-cover object-center shadow-[0_40px_90px_-40px_rgba(37,99,235,0.6)] ring-1 ring-brand/10 md:aspect-[4/5]"
            />
          </div>
        </div>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid items-start gap-12 md:gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* Photo — same open treatment as the hero: asymmetric corners, glow behind, no container */}
          <ScrollReveal scale>
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-tl-[6rem] rounded-br-[6rem] bg-linear-to-br from-brand/25 via-cyan-400/15 to-transparent blur-2xl"
              />
              <img
                src={aboutPhoto}
                alt="Wavez Club members at a club workshop"
                loading="lazy"
                className="relative aspect-[16/10] w-full rounded-tl-[6rem] rounded-br-[6rem] bg-card object-cover object-center shadow-[0_40px_90px_-40px_rgba(37,99,235,0.55)] ring-1 ring-brand/10 md:aspect-[4/5]"
              />
            </div>
          </ScrollReveal>

          {/* Text — directly on the page with generous whitespace */}
          <ScrollReveal delay={0.15} from={18} duration={0.3}>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold text-brand">
                Who we are
              </span>
              <h2 className="mt-5 font-display text-3xl leading-tight font-bold md:text-4xl">
                A community that learns, builds and innovates — all year long.
              </h2>
              <p className="mt-5 max-w-xl font-semibold text-foreground/80">
                Wavez Club is a student-led scientific community turning classroom theory into
                hands-on experience. Through competitions, workshops and mentorship, members explore
                electronics, embedded systems, AI, robotics and IoT — and ship working prototypes.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {["Workshops & training", "Competitions & build-offs", "Projects & mentorship"].map(
                  (chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-brand/20 bg-card/70 px-4 py-1.5 text-sm font-bold text-brand-deep"
                    >
                      {chip}
                    </span>
                  ),
                )}
              </div>

              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#leaders"
                  className="clay-md group inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Meet the leadership team
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </a>
                <Link
                  to="/about"
                  className="clay-sm group inline-flex items-center gap-2 rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Learn more about WaveZ
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      {leaders.length > 0 && (
        <section id="leaders" className="mx-auto max-w-6xl px-5 pb-16">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Leadership Team — 2026/2027
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-2 max-w-3xl font-semibold text-muted-foreground">
                The student officers keeping Wavez Club running — competitions, workshops and
                projects.
              </p>
            </ScrollReveal>
          </div>
          <div className="mt-8">
            <LeadersCarousel leaders={leaders} />
          </div>
        </section>
      )}

      <MentorsSection members={team} />

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      <section id="submissions" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <ScrollReveal>
              <p className="text-xs font-extrabold tracking-widest text-brand uppercase">
                Announcements
              </p>
              <h2 className="mt-2 font-display text-4xl leading-tight font-bold md:text-5xl">
                Open for submission
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-3 max-w-2xl font-semibold text-muted-foreground">
                Every announcement here is a live submission — an open day or a club event you can
                apply to right now, from the card itself.
              </p>
            </ScrollReveal>
          </div>
        </div>

        {postsLoading ? (
          <p className="mt-8 font-semibold text-muted-foreground">Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <div className="mt-10 max-w-2xl border-t border-foreground/10 pt-8">
            <p className="font-display text-xl font-bold">No submission is open right now</p>
            <p className="mt-2 font-semibold text-muted-foreground">
              We open a new submission before every open day and club event — check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-8 md:gap-10">
            {announcements.map((announcement, index) => (
              <SubmissionAnnouncementCard
                key={announcement.id}
                announcement={announcement}
                index={index}
                campaign={
                  announcement.campaign_id
                    ? (openCampaignsById.get(announcement.campaign_id) ?? null)
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Trusted-by style logo strip — faculty + club identity */}
      <section aria-label="Affiliations" className="mx-auto max-w-6xl px-5 pt-12 pb-28">
        <ScrollReveal>
          <div className="flex flex-col items-center">
            <p className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              Affiliated with
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-24 gap-y-9 md:gap-x-32 lg:gap-x-40">
              <img
                src={facultyLogo}
                alt="Faculté de Génie Électrique, Université Djilali Liabès logo"
                className="h-24 w-auto max-w-60 object-contain md:h-32 lg:h-40"
              />
              <img
                src={wavezLogoMark}
                alt="Wavez Club logo"
                className="h-24 w-auto max-w-60 object-contain md:h-32 lg:h-40"
              />
            </div>
          </div>
        </ScrollReveal>
      </section>

      <SiteFooter />
    </div>
  );
}

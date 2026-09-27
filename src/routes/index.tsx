import { ArrowRight, Pin } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OpenCampaign } from "@/lib/registrations";
import { BoltDivider } from "@/components/circuit-board";
import { ScrollReveal } from "@/components/scroll-reveal";
import { PulseDot } from "@/components/pulse-dot";
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

type Post = {
  id: string;
  kind: "event" | "news";
  title: string;
  body: string;
  location: string | null;
  event_date: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** True while the event date is within the next 7 days (and not in the past). */
function isUpcomingSoon(value: string): boolean {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  const diff = time - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

/** Urgency label for a known upcoming event date: Today / Tomorrow / In X days. */
function countdownLabel(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const diff = time - Date.now();
  if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return null;
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Small readable urgency badge for featured events with a known date. */
function EventCountdown({ eventDate }: { eventDate: string }) {
  const label = countdownLabel(eventDate);
  if (!label) return null;
  const isToday = label === "Today";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wider uppercase ${
        isToday ? "bg-brand text-white" : "bg-brand/15 text-brand"
      }`}
    >
      {label}
    </span>
  );
}

function Index() {
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["public-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, kind, title, body, location, event_date, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) throw error;
      return data as Post[];
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

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
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

  const hasOpenCampaigns = campaigns.length > 0;
  const [featuredCampaign, ...restCampaigns] = campaigns;

  // Announcement feed — the single most urgent upcoming event gets bumped to
  // front and treated as "featured"; the rest keep the standard treatment.
  const feed: Post[] = (() => {
    const first =
      posts.find(
        (post) => post.kind === "event" && post.event_date && isUpcomingSoon(post.event_date),
      ) ?? posts[0];
    if (!first) return [];
    return [first, ...posts.filter((post) => post.id !== first.id)];
  })();

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
              <a
                href="#join"
                className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Join a campaign
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

      <section id="news" className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <ScrollReveal>
              <p className="text-xs font-extrabold tracking-widest text-brand uppercase">
                Announcements
              </p>
              <h2 className="mt-2 font-display text-4xl leading-tight font-bold md:text-5xl">
                What's Happening
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-3 max-w-2xl font-semibold text-muted-foreground">
                Club meetings, workshops and announcements.
              </p>
            </ScrollReveal>
          </div>
        </div>

        {postsLoading ? (
          <p className="mt-8 font-semibold text-muted-foreground">Loading updates…</p>
        ) : feed.length === 0 ? (
          <div className="mt-10 max-w-2xl border-t border-foreground/10 pt-8">
            <p className="font-display text-xl font-bold">Nothing posted yet</p>
            <p className="mt-2 font-semibold text-muted-foreground">
              Our next meetings and announcements will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-10">
            {feed.map((post, index) => {
              const isFeatured = index === 0;
              const isEvent = post.kind === "event";
              // An event with a live campaign is a registration, not a notice —
              // the badge has to say so before anyone reads the title.
              const isRegistration = isFeatured && isEvent && hasOpenCampaigns;
              const kindLabel = isRegistration
                ? "Registration open"
                : isEvent
                  ? "Event"
                  : isFeatured
                    ? "Announcement"
                    : "News";
              const kindClass = isRegistration
                ? "bg-brand text-primary-foreground"
                : isEvent
                  ? "bg-brand/15 text-brand"
                  : "bg-mint/25 text-mint-foreground";
              return (
                <ScrollReveal key={post.id} delay={Math.min(0.08 * index, 0.24)} scale>
                  {isFeatured ? (
                    <article className="group hover-glow rounded-3xl border border-brand/20 bg-card p-6 shadow-sm transition-transform duration-200 ease-out hover:pointer-fine:-translate-y-1 md:p-10">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                          <Pin aria-hidden="true" className="size-6 -rotate-12" />
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold tracking-widest uppercase ${kindClass}`}
                        >
                          {isRegistration && <PulseDot />}
                          {kindLabel}
                        </span>
                        {post.event_date && <EventCountdown eventDate={post.event_date} />}
                        {post.event_date && (
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
                            {isUpcomingSoon(post.event_date) && <PulseDot />}
                            <span>📅 {formatDate(post.event_date)}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="mt-6 max-w-4xl font-display text-3xl leading-tight font-bold text-brand-deep transition-colors duration-200 group-hover:text-brand md:text-5xl">
                        {post.title}
                      </h3>
                      {post.location && (
                        <p className="mt-3 text-base font-bold text-brand">📍 {post.location}</p>
                      )}
                      <p className="mt-5 max-w-3xl text-base leading-relaxed font-semibold whitespace-pre-line text-foreground/80 md:text-lg">
                        {post.body}
                      </p>
                      {isRegistration && (
                        <div className="mt-8">
                          <a
                            href="#join"
                            className="cta-pulse clay-md group inline-flex items-center gap-2 rounded-2xl bg-brand px-8 py-4 text-lg font-bold text-primary-foreground transition-transform duration-200 hover:pointer-fine:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                          >
                            Register now
                            <ArrowRight
                              aria-hidden="true"
                              className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                            />
                          </a>
                        </div>
                      )}
                    </article>
                  ) : (
                    <article className="group border-t border-foreground/10 py-12">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-extrabold tracking-widest uppercase ${kindClass}`}
                        >
                          {kindLabel}
                        </span>
                        {post.event_date && (
                          <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            {isUpcomingSoon(post.event_date) && <PulseDot />}
                            <span>📅 {formatDate(post.event_date)}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="mt-4 font-display text-2xl leading-tight font-bold transition-colors duration-200 group-hover:text-brand md:text-3xl">
                        {post.title}
                      </h3>
                      {post.location && (
                        <p className="mt-2 text-sm font-bold text-brand">📍 {post.location}</p>
                      )}
                      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed font-semibold whitespace-pre-line text-foreground/75">
                        {post.body}
                      </p>
                    </article>
                  )}
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </section>

      <section id="join" className="mx-auto max-w-6xl px-5 pt-10 pb-20">
        <ScrollReveal>
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold tracking-widest text-brand uppercase">
              Registrations
            </p>
            <h2 className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 font-display text-4xl leading-tight font-bold md:text-5xl">
              <span>
                {hasOpenCampaigns ? "Join an open registration" : "Registrations closed right now"}
              </span>
              {hasOpenCampaigns && (
                <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold tracking-widest text-brand uppercase md:text-sm">
                  <PulseDot />
                  Open now
                </span>
              )}
            </h2>
            <p className="mt-3 max-w-2xl font-semibold text-foreground/75">
              Pick a campaign to apply — our team reviews every submission.
            </p>
          </div>
        </ScrollReveal>

        {campaignsLoading ? (
          <p className="mt-10 font-semibold text-muted-foreground">Loading open campaigns…</p>
        ) : !hasOpenCampaigns ? (
          <div className="mt-10 max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-muted px-4 py-1.5 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              Closed
            </span>
            <p className="mt-5 font-display text-2xl font-bold text-foreground/60">
              No open registration right now
            </p>
            <p className="mt-2 font-semibold text-muted-foreground">
              Check back soon — we open new drives before every event and season.
            </p>
          </div>
        ) : (
          <>
            {/* Featured campaign — the single most urgent thing to apply for. */}
            {featuredCampaign && (
              <ScrollReveal>
                <Link
                  to="/register/$campaignId"
                  params={{ campaignId: featuredCampaign.id }}
                  className="group hover-glow mt-10 block transition-transform duration-200 hover:pointer-fine:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold tracking-widest text-brand uppercase">
                      <PulseDot />
                      Open now
                    </span>
                    <span className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                      Featured registration
                    </span>
                  </span>
                  <h3 className="mt-4 max-w-3xl font-display text-3xl leading-tight font-bold text-brand-deep transition-colors duration-200 group-hover:text-brand md:text-5xl">
                    {featuredCampaign.title}
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed font-semibold text-muted-foreground md:text-lg">
                    {featuredCampaign.description}
                  </p>
                  <p className="mt-6 border-b border-brand/25 pb-3 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
                    {featuredCampaign.kind === "event" ? "Event participation" : "Membership drive"}
                    {featuredCampaign.custom_questions.length > 0 &&
                      ` · ${featuredCampaign.custom_questions.length} question${
                        featuredCampaign.custom_questions.length === 1 ? "" : "s"
                      }`}
                  </p>
                  <span className="cta-pulse clay-md mt-7 inline-flex w-fit items-center gap-2 rounded-2xl bg-brand px-9 py-4 text-lg font-bold text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                    Apply now
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </ScrollReveal>
            )}

            {/* Remaining open campaigns — keep the standard card treatment. */}
            {restCampaigns.length > 0 && (
              <div className="mt-14 grid gap-x-16 gap-y-14 md:grid-cols-2">
                {restCampaigns.map((campaign, index) => (
                  <ScrollReveal key={campaign.id} delay={Math.min(index * 0.08, 0.16)} scale>
                    <Link
                      to="/register/$campaignId"
                      params={{ campaignId: campaign.id }}
                      className="group hover-glow flex flex-col transition-transform duration-200 hover:pointer-fine:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-widest text-brand uppercase">
                        <PulseDot />
                        <span>Open · #{index + 2}</span>
                      </p>
                      <h3 className="mt-3 font-display text-2xl leading-tight font-bold text-brand-deep transition-colors duration-200 group-hover:text-brand md:text-3xl">
                        {campaign.title}
                      </h3>
                      {campaign.description && (
                        <p className="mt-3 text-[15px] leading-relaxed font-semibold text-muted-foreground">
                          {campaign.description}
                        </p>
                      )}
                      <p className="mt-6 border-b border-brand/25 pb-3 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
                        {campaign.kind === "event" ? "Event participation" : "Membership drive"}
                        {campaign.custom_questions.length > 0 &&
                          ` · ${campaign.custom_questions.length} question${
                            campaign.custom_questions.length === 1 ? "" : "s"
                          }`}
                      </p>
                      <span className="clay-md mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                        Apply now
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </span>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </>
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

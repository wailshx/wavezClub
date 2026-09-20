import { ArrowRight } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OpenCampaign } from "@/lib/registrations";
import { BoltDivider } from "@/components/circuit-board";
import { ScrollReveal } from "@/components/scroll-reveal";
import { LeadersCarousel } from "@/components/leaders-carousel";
import { MentorsSection } from "@/components/mentors-section";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import facultyLogo from "@/assets/faculty-logo.png";
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
              src="/IMG_0246.PNG"
              alt="Wavez Club students working on electronics and robotics projects"
              className="relative aspect-[16/10] w-full rounded-tl-[6rem] rounded-br-[6rem] bg-card object-cover shadow-[0_40px_90px_-40px_rgba(37,99,235,0.6)] ring-1 ring-brand/10 md:aspect-[4/5]"
            />
          </div>
        </div>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <ScrollReveal>
          <div className="image-glow-frame">
            <div className="hero-glass overflow-hidden rounded-4xl">
              <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch">
                {/* Photo — top portion on mobile, left column on desktop, inside the same panel */}
                <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-full">
                  <img
                    src="/IMG_0246.PNG"
                    alt="Wavez Club members at a club workshop"
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>

                {/* Text — below the photo on mobile, right column on desktop */}
                <div className="p-8 md:p-10 lg:p-12">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold text-brand">
                    Who we are
                  </span>
                  <h2 className="mt-4 font-display text-3xl leading-tight font-bold md:text-4xl">
                    A community that learns, builds and innovates — all year long.
                  </h2>
                  <p className="mt-4 max-w-xl font-semibold text-foreground/80">
                    Wavez Club is a student-led scientific community turning classroom theory into
                    hands-on experience. Through competitions, workshops and mentorship, members
                    explore electronics, embedded systems, AI, robotics and IoT — and ship working
                    prototypes.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {[
                      "Workshops & training",
                      "Competitions & build-offs",
                      "Projects & mentorship",
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-brand/20 bg-card/70 px-4 py-1.5 text-sm font-bold text-brand-deep"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href="#leaders"
                      className="clay-md group inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      Meet our team
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
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      {leaders.length > 0 && (
        <section id="leaders" className="mx-auto max-w-6xl px-5 pb-16">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold">Meet our team</h2>
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

      <section id="news" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-3xl font-bold">Events &amp; news</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-2 font-semibold text-muted-foreground">
                Club meetings, workshops and announcements.
              </p>
            </ScrollReveal>
          </div>
        </div>

        {postsLoading ? (
          <p className="mt-8 font-semibold text-muted-foreground">Loading updates…</p>
        ) : posts.length === 0 ? (
          <div className="clay-sm mt-6 rounded-3xl bg-card p-8 text-center">
            <p className="font-display text-xl font-bold">Nothing posted yet</p>
            <p className="mt-2 font-semibold text-muted-foreground">
              Our next meetings and announcements will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-7 md:grid-cols-2">
            {posts.map((post, index) => (
              <ScrollReveal key={post.id} delay={Math.min(index * 0.08, 0.24)}>
                <article className="premium-card h-full rounded-4xl p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${
                        post.kind === "event"
                          ? "bg-brand/15 text-brand"
                          : "bg-mint/25 text-mint-foreground"
                      }`}
                    >
                      {post.kind === "event" ? "Event" : "News"}
                    </span>
                    {post.event_date && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-card/80 px-3.5 py-1.5 text-xs font-bold text-brand-deep">
                        📅 {formatDate(post.event_date)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-2xl leading-tight font-bold">
                    {post.title}
                  </h3>
                  {post.location && (
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand">
                      📍 {post.location}
                    </p>
                  )}
                  <p className="mt-3 line-clamp-4 text-[15px] leading-relaxed font-semibold whitespace-pre-line text-muted-foreground">
                    {post.body}
                  </p>
                  <p className="mt-6 border-t border-brand/10 pt-4 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                    Wavez Club
                  </p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        )}
      </section>

      <section id="join" className="mx-auto max-w-6xl px-5 pb-16">
        <ScrollReveal>
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold md:text-4xl">Open registrations</h2>
              <p className="mt-2 font-semibold text-foreground/75">
                Pick a campaign to apply — our team reviews every submission.
              </p>
            </div>

            {campaignsLoading ? (
              <p className="mt-8 font-semibold text-muted-foreground">Loading open campaigns…</p>
            ) : campaigns.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-brand/25 bg-card/60 px-6 py-8">
                <p className="font-display text-lg font-bold text-brand-deep">
                  No open registration right now
                </p>
                <p className="mt-1 font-semibold text-muted-foreground">
                  Check back soon — we open new drives before every event and season.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-8 md:grid-cols-2">
                {campaigns.map((campaign, index) => (
                  <Link
                    key={campaign.id}
                    to="/register/$campaignId"
                    params={{ campaignId: campaign.id }}
                    className="premium-card group flex flex-col rounded-4xl p-8 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-3.5 py-1.5 text-xs font-extrabold text-mint-foreground">
                        {index === 0 ? "Featured" : `Open · #${index + 1}`}
                      </span>
                      <span className="text-3xl">⛵</span>
                    </div>
                    <h3 className="mt-5 font-display text-2xl leading-tight font-bold text-brand-deep">
                      {campaign.title}
                    </h3>
                    {campaign.description && (
                      <p className="mt-3 flex-1 text-[15px] leading-relaxed font-semibold text-muted-foreground">
                        {campaign.description}
                      </p>
                    )}
                    <div className="mt-8 flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
                        {campaign.kind === "event" ? "Event participation" : "Membership drive"}
                        {campaign.custom_questions.length > 0 &&
                          ` · ${campaign.custom_questions.length} question${
                            campaign.custom_questions.length === 1 ? "" : "s"
                          }`}
                      </span>
                      <span className="clay-md inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
                        Apply now
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollReveal>
      </section>

      {/* Trusted-by style logo strip — faculty + club identity */}
      <section aria-label="Affiliations" className="mx-auto max-w-6xl px-5 py-8 pb-28">
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

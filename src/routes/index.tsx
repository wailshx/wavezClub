import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OpenCampaign } from "@/lib/registrations";
import logo from "@/assets/wavez-logo.png";
import { CircuitCard } from "@/components/circuit-card";
import { BoltDivider } from "@/components/circuit-board";
import { ScrollReveal } from "@/components/scroll-reveal";
import { LeadersCarousel } from "@/components/leaders-carousel";
import { MentorsSection } from "@/components/mentors-section";
import { fetchPublicLeaders } from "@/lib/leaders";
import { fetchPublicTeamMembers } from "@/lib/team";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wavez Club — Learn. Build. Innovate." },
      {
        name: "description",
        content:
          "Wavez Club at the Faculty of Electrical Engineering, Djillali Liabès University of Sidi Bel Abbès: electronics, robotics, AI, embedded systems and IoT.",
      },
      { property: "og:title", content: "Wavez Club — Learn. Build. Innovate." },
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
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-5 pt-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Wavez Club logo" width={64} height={64} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-none font-bold text-brand-deep">
                Wavez
              </p>
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground">
                Club
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 text-sm font-bold md:flex">
              <a
                href="#about"
                className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand"
              >
                About
              </a>
              <a
                href="#activities"
                className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand"
              >
                Activities
              </a>
              <a
                href="#leaders"
                className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand"
              >
                Team
              </a>
              <a
                href="#news"
                className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand"
              >
                Events
              </a>
              <a
                href="#join"
                className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand"
              >
                Join
              </a>
            </nav>
          </div>
        </div>
      </header>

      <section className="hero-stage relative overflow-hidden">
        <div aria-hidden="true" className="hero-orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
          <span className="hero-orb hero-orb--c" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl px-5 pt-12 pb-16 md:min-h-[600px] md:items-center md:pt-8 md:pb-20">
          <div className="hero-glass animate-rise max-w-2xl rounded-4xl p-8 md:p-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
              Faculty of Electrical Engineering · Djillali Liabès University, Sidi Bel Abbès
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] font-bold md:text-6xl">
              Learn. Build. Innovate.
            </h1>
            <p className="mt-5 text-lg font-semibold text-foreground/75">
              Wavez Club is a student-led scientific and technological community bringing together
              students passionate about electronics, electrical engineering, automation, artificial
              intelligence, robotics, embedded systems and IoT.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#join"
                className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Join a campaign
              </a>
              <a
                href="#news"
                className="clay-sm rounded-2xl bg-card px-7 py-3.5 font-bold text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Events &amp; news
              </a>
            </div>
          </div>
        </div>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-bold">About Wavez Club</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="mt-3 max-w-3xl font-semibold text-muted-foreground">
            We create an environment where students explore technology beyond the classroom, develop
            practical engineering skills, collaborate on projects and transform ideas into working
            solutions. Our mission is to turn academic knowledge into real experience through
            workshops, technical projects, competitions, scientific events, training sessions and
            collaborations with industry.
          </p>
        </ScrollReveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: "⚡",
              tint: "bg-brand/15 text-brand",
              title: "Electronics & embedded",
              text: "Benchwork, PCB design, microcontrollers and power electronics — hands-on, not slides.",
            },
            {
              icon: "🤖",
              tint: "bg-mint/25 text-mint-foreground",
              title: "AI, robotics & autonomy",
              text: "Machine learning, computer vision, automation and autonomous systems projects.",
            },
            {
              icon: "🤝",
              tint: "bg-lilac/25 text-lilac-foreground",
              title: "A scientific community",
              text: "Mentorship, competitions and collaboration with industry and research partners.",
            },
          ].map((card) => (
            <CircuitCard key={card.title} className="clay-sm rounded-3xl bg-card p-7">
              <div
                className={`circuit-glow clay-sm grid size-12 place-items-center rounded-2xl text-2xl ${card.tint}`}
              >
                {card.icon}
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{card.text}</p>
            </CircuitCard>
          ))}
        </div>
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

      <section id="activities" className="mx-auto max-w-6xl px-5 pb-16">
        <ScrollReveal>
          <h2 className="font-display text-3xl font-bold">What we do all year</h2>
        </ScrollReveal>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <CircuitCard className="clay-md rounded-3xl bg-brand p-7 text-primary-foreground">
            <p className="text-4xl">🏆</p>
            <h3 className="mt-3 font-display text-xl font-bold text-primary-foreground">
              Competitions
            </h3>
            <p className="mt-2 text-sm font-semibold text-primary-foreground/80">
              Hackathons, robotics challenges and build-offs where teams ship a working prototype.
            </p>
          </CircuitCard>
          <CircuitCard className="clay-md rounded-3xl bg-card p-7">
            <p className="text-4xl">🛠️</p>
            <h3 className="mt-3 font-display text-xl font-bold">Workshops &amp; training</h3>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Practical sessions on embedded systems, IoT, PCB design, Python and machine learning.
            </p>
          </CircuitCard>
          <CircuitCard className="clay-md rounded-3xl bg-card p-7">
            <p className="text-4xl">🎓</p>
            <h3 className="mt-3 font-display text-xl font-bold">Projects &amp; mentorship</h3>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              L1–L3 students guided by master's students and teachers toward real technical
              projects.
            </p>
          </CircuitCard>
        </div>
      </section>

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
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {posts.map((post, index) => (
              <ScrollReveal key={post.id} delay={Math.min(index * 0.08, 0.24)}>
                <article className="clay-sm rounded-3xl bg-card p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase ${
                        post.kind === "event"
                          ? "bg-brand/15 text-brand"
                          : "bg-mint/25 text-mint-foreground"
                      }`}
                    >
                      {post.kind}
                    </span>
                    {post.event_date && (
                      <span className="text-xs font-bold text-muted-foreground">
                        {formatDate(post.event_date)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold">{post.title}</h3>
                  {post.location && (
                    <p className="mt-1 text-xs font-bold text-brand">📍 {post.location}</p>
                  )}
                  <p className="mt-3 text-sm font-semibold whitespace-pre-line text-muted-foreground">
                    {post.body}
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
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {campaigns.map((campaign, index) => (
                  <Link
                    key={campaign.id}
                    to="/register/$campaignId"
                    params={{ campaignId: campaign.id }}
                    className="campaign-card group rounded-4xl p-6 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-3 py-1 text-xs font-extrabold text-mint-foreground">
                        {index === 0 ? "Featured" : `Open · #${index + 1}`}
                      </span>
                      <span className="text-2xl">⛵</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl font-bold text-brand-deep">
                      {campaign.title}
                    </h3>
                    {campaign.description && (
                      <p className="mt-2 line-clamp-3 font-semibold text-muted-foreground">
                        {campaign.description}
                      </p>
                    )}
                    <div className="mt-6 flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold tracking-wide text-brand uppercase">
                        {campaign.kind === "event" ? "Event participation" : "Membership drive"}
                        {campaign.custom_questions.length > 0 &&
                          ` · ${campaign.custom_questions.length} question${
                            campaign.custom_questions.length === 1 ? "" : "s"
                          }`}
                      </span>
                      <span className="clay-sm inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
                        Apply now
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-center text-xs font-semibold text-muted-foreground">
        <p className="font-display text-sm font-bold text-brand-deep">WAVEZ CLUB</p>
        <p className="mt-1">Learn. Build. Innovate.</p>
        <p className="mt-2">
          Faculté de Génie Électrique · Université Djillali Liabès de Sidi Bel Abbès
        </p>
        <p>Campus universitaire, Sidi Bel Abbès 22000, Algeria</p>
      </footer>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, LEVELS, SPECIALITIES, memberSchema } from "@/lib/club";
import logo from "@/assets/wavez-logo.png";
import { CircuitCard } from "@/components/circuit-card";
import { BoltDivider, HeroPulse, PcbBackground } from "@/components/circuit-board";

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

const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-card px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-mint";
const labelClass = "text-xs font-extrabold uppercase tracking-wide text-primary-foreground/85";

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
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const parsed = memberSchema.safeParse(raw);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your answers");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("members").insert(parsed.data);
    setSubmitting(false);

    if (error) {
      toast.error("We couldn't send your application. Please try again.");
      return;
    }
    form.reset();
    setDone(true);
    toast.success("Application sent! We'll contact you soon.");
  }

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

      <section className="mx-auto max-w-6xl px-5 pt-10 pb-16">
        <div className="clay-lg relative overflow-hidden rounded-4xl bg-card/80 p-8 md:p-14">
          <PcbBackground />
          <HeroPulse />

          <div className="animate-rise relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
              Faculty of Electrical Engineering · Djillali Liabès University, Sidi Bel Abbès
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] font-bold md:text-6xl">
              Learn. Build. Innovate.
            </h1>
            <p className="mt-5 text-lg font-semibold text-muted-foreground">
              Wavez Club is a student-led scientific and technological community bringing together
              students passionate about electronics, electrical engineering, automation, artificial
              intelligence, robotics, embedded systems and IoT.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#join"
                className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground"
              >
                Become a member
              </a>
              <a
                href="#news"
                className="clay-sm rounded-2xl bg-card px-7 py-3.5 font-bold text-brand-deep"
              >
                Events &amp; news
              </a>
            </div>
          </div>
        </div>
      </section>

      <BoltDivider />

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-3xl font-bold">About Wavez Club</h2>
        <p className="mt-3 max-w-3xl font-semibold text-muted-foreground">
          We create an environment where students explore technology beyond the classroom, develop
          practical engineering skills, collaborate on projects and transform ideas into working
          solutions. Our mission is to turn academic knowledge into real experience through
          workshops, technical projects, competitions, scientific events, training sessions and
          collaborations with industry.
        </p>
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

      <BoltDivider />

      <section id="activities" className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-3xl font-bold">What we do all year</h2>
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

      <BoltDivider />

      <section id="news" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-bold">Events &amp; news</h2>
            <p className="mt-2 font-semibold text-muted-foreground">
              Club meetings, workshops and announcements.
            </p>
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
            {posts.map((post) => (
              <article key={post.id} className="clay-sm animate-rise rounded-3xl bg-card p-7">
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
            ))}
          </div>
        )}
      </section>

      <section id="join" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="clay-lg rounded-3xl bg-brand p-8 md:p-12">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Join Wavez Club
            </h2>
            <p className="mt-2 font-semibold text-primary-foreground/80">
              Fill this in and our team will reach out before the next session.
            </p>

            {done ? (
              <div className="clay-md mt-8 rounded-3xl bg-card p-8">
                <p className="font-display text-2xl font-bold">Application received 🎉</p>
                <p className="mt-2 font-semibold text-muted-foreground">
                  Thanks for applying. The club team will contact you by email.
                </p>
                <button
                  onClick={() => setDone(false)}
                  className="clay-sm mt-6 rounded-2xl bg-mint px-6 py-3 font-extrabold text-brand-deep"
                >
                  Register another member
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="full_name">
                    Full name
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    required
                    maxLength={100}
                    placeholder="Yasmine Boudiaf"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="age">
                    Age
                  </label>
                  <input
                    id="age"
                    name="age"
                    type="number"
                    min={15}
                    max={99}
                    required
                    placeholder="21"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={255}
                    placeholder="yasmine@univ-sba.dz"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="0550 12 34 56"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="speciality">
                    Speciality
                  </label>
                  <select id="speciality" name="speciality" className={inputClass}>
                    {SPECIALITIES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="level">
                    Level
                  </label>
                  <select id="level" name="level" className={inputClass}>
                    {LEVELS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass} htmlFor="department">
                    Preferred department
                  </label>
                  <select id="department" name="department" className={inputClass}>
                    {DEPARTMENTS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 md:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="clay-md w-full rounded-2xl bg-card px-8 py-3.5 font-extrabold text-brand-deep disabled:opacity-70 md:w-auto"
                  >
                    {submitting ? "Sending…" : "Send my application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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

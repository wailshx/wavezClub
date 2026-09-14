import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, LEVELS, SPECIALITIES, memberSchema } from "@/lib/club";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wavez — Electrical & Electronic Engineering Club" },
      {
        name: "description",
        content:
          "Join Wavez, the scientific club of electrical & electronic engineering students at Djillali Liabes University, Sidi Bel Abbès.",
      },
      { property: "og:title", content: "Wavez — Electrical & Electronic Engineering Club" },
      {
        property: "og:description",
        content: "Hands-on labs, contests and mentorship for EE students in Sidi Bel Abbès.",
      },
    ],
  }),
  component: Index,
});

const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-card px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-lemon";
const labelClass = "text-xs font-extrabold uppercase tracking-wide text-primary-foreground/85";

function Index() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="clay-sm grid size-12 place-items-center rounded-2xl bg-brand font-display text-xl text-primary-foreground">
              W
            </div>
            <div>
              <p className="font-display text-lg leading-none font-bold text-foreground">Wavez</p>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                EE Student Club
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-2 text-sm font-bold md:flex">
            <a href="#about" className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand-deep">
              About
            </a>
            <a
              href="#activities"
              className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand-deep"
            >
              Activities
            </a>
            <a href="#join" className="rounded-xl px-4 py-2 text-muted-foreground hover:text-brand-deep">
              Join
            </a>
          </nav>
          <Link
            to="/admin"
            className="clay-sm rounded-2xl bg-lilac/40 px-5 py-2.5 text-sm font-bold text-lilac-foreground"
          >
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-10 pb-16">
        <div className="clay-lg relative overflow-hidden rounded-4xl bg-card/70 p-8 md:p-14">
          <div className="clay-md animate-floaty absolute -top-10 -right-6 size-40 rounded-full bg-lemon" />
          <div className="clay-md animate-floaty-tilt absolute bottom-8 -left-8 size-28 rounded-full bg-mint" />
          <div className="clay-sm animate-floaty absolute top-24 left-1/2 size-16 rounded-full bg-blossom" />

          <div className="animate-rise relative max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/40 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
              Djillali Liabes University · Sidi Bel Abbès
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] font-bold md:text-6xl">
              Where circuits meet curiosity.
            </h1>
            <p className="mt-5 text-lg font-semibold text-muted-foreground">
              Wavez is the electrical &amp; electronic engineering club for students who love
              building, breaking, and learning how things work.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#join"
                className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground"
              >
                Become a member
              </a>
              <a
                href="#activities"
                className="clay-sm rounded-2xl bg-card px-7 py-3.5 font-bold text-brand-deep"
              >
                See what we do
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: "⚡",
              tint: "bg-brand/15 text-brand-deep",
              title: "Hands-on labs",
              text: "Benchtime, oscilloscopes, and real soldering — not just slides.",
            },
            {
              icon: "🔬",
              tint: "bg-blossom/20 text-blossom-foreground",
              title: "Scientific spirit",
              text: "Research talks, paper clubs, and mentorship from senior engineers.",
            },
            {
              icon: "🤝",
              tint: "bg-mint/30 text-mint-foreground",
              title: "A real community",
              text: "Hackathons, contests, and friendships that outlast the semester.",
            },
          ].map((card) => (
            <div key={card.title} className="clay-sm rounded-3xl bg-card p-7">
              <div className={`clay-sm grid size-12 place-items-center rounded-2xl text-2xl ${card.tint}`}>
                {card.icon}
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="activities" className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-3xl font-bold">What we do all year</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="clay-md rounded-3xl bg-brand p-7 text-primary-foreground">
            <p className="text-4xl">🏆</p>
            <h3 className="mt-3 font-display text-xl font-bold text-primary-foreground">
              Circuit Contest
            </h3>
            <p className="mt-2 text-sm font-semibold text-primary-foreground/80">
              A timed build-off where teams race to finish a working prototype.
            </p>
          </div>
          <div className="clay-md rounded-3xl bg-card p-7">
            <p className="text-4xl">🛠️</p>
            <h3 className="mt-3 font-display text-xl font-bold">Weekly Lab Nights</h3>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Drop-in sessions on embedded systems, PCB design, and power electronics.
            </p>
          </div>
          <div className="clay-md rounded-3xl bg-card p-7">
            <p className="text-4xl">🎓</p>
            <h3 className="mt-3 font-display text-xl font-bold">Mentorship Tracks</h3>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              L1–L2 students guided by master's students toward a capstone project.
            </p>
          </div>
        </div>
      </section>

      <section id="join" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="clay-lg rounded-3xl bg-brand p-8 md:p-12">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
              Join Wavez
            </h2>
            <p className="mt-2 font-semibold text-primary-foreground/80">
              Fill this in and our team will reach out after the next lab night.
            </p>

            {done ? (
              <div className="clay-md mt-8 rounded-3xl bg-card p-8">
                <p className="font-display text-2xl font-bold">Application received 🎉</p>
                <p className="mt-2 font-semibold text-muted-foreground">
                  Thanks for applying. The club team will contact you by email.
                </p>
                <button
                  onClick={() => setDone(false)}
                  className="clay-sm mt-6 rounded-2xl bg-lemon px-6 py-3 font-extrabold text-lemon-foreground"
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
                    className="clay-md w-full rounded-2xl bg-lemon px-8 py-3.5 font-extrabold text-lemon-foreground disabled:opacity-70 md:w-auto"
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
        Wavez · Faculty of Electrical &amp; Electronic Engineering · Djillali Liabes University, Sidi
        Bel Abbès
      </footer>
    </div>
  );
}

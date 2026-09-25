import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, ChevronDown, MapPin } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BoltDivider } from "@/components/circuit-board";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About WaveZ — Wavez Club" },
      {
        name: "description",
        content:
          "WaveZ Scientific Club — a student-led scientific and technological community at Université Djilali Liabès of Sidi Bel Abbès. Our mission, vision, activities and values.",
      },
      { property: "og:title", content: "About WaveZ — Wavez Club" },
    ],
  }),
  component: AboutPage,
});

// ─── Data (club's official content) ──────────────────────────────────────────

const AREAS = [
  {
    icon: "🔬",
    title: "Science & Engineering",
    text: "WaveZ promotes scientific curiosity and engineering thinking through technical activities, educational sessions, experiments, and problem-solving challenges.",
  },
  {
    icon: "🤖",
    title: "Robotics & Autonomous Systems",
    text: "The club introduces students to robotics, automation, sensors, actuators, embedded control systems, and autonomous technologies through practical projects and workshops.",
  },
  {
    icon: "🧠",
    title: "Artificial Intelligence",
    text: "WaveZ encourages students to explore Artificial Intelligence and its applications in engineering, robotics, automation, computer vision, data processing, and intelligent systems.",
  },
  {
    icon: "⚡",
    title: "Electronics & Embedded Systems",
    text: "Students can learn about electronic circuits, microcontrollers, sensors, communication systems, PCB design, ESP32 and other embedded platforms, with a strong emphasis on building functional prototypes.",
  },
  {
    icon: "🌐",
    title: "Internet of Things",
    text: "The club explores connected systems and IoT technologies, combining embedded hardware, sensors, wireless communication, software, and cloud or mobile applications.",
  },
  {
    icon: "🖥️",
    title: "Programming & Software",
    text: "WaveZ promotes programming and software development as essential tools for modern engineers, including applications related to embedded systems, automation, artificial intelligence, web development, and mobile applications.",
  },
  {
    icon: "🧩",
    title: "PCB Design & Hardware Development",
    text: "Through practical workshops, students can learn the complete PCB development process, from schematic design and component selection to PCB layout, manufacturing, assembly, and testing using professional tools such as KiCad.",
  },
  {
    icon: "🛠️",
    title: "CAD & 3D Design",
    text: "The club also develops students' skills in computer-aided design and 3D modeling through tools such as Fusion 360, with applications in mechanical design, robotics, prototyping, and manufacturing.",
  },
] as const;

const FIELDS = [
  "Electrical Engineering",
  "Artificial Intelligence",
  "Autonomous Systems",
  "Robotics",
  "Internet of Things",
  "Embedded Systems",
  "Electronics",
  "PCB Design",
  "3D Design",
] as const;

const ACTIVITIES = [
  "Technical workshops",
  "Scientific conferences",
  "Hands-on training sessions",
  "Robotics and IoT projects",
  "Electronics and PCB workshops",
  "Programming sessions",
  "Artificial Intelligence activities",
  "3D design and CAD workshops",
  "Company and laboratory visits",
  "Scientific competitions",
  "Mathematics competitions and olympiads",
  "Hackathons and innovation challenges",
  "Collaborative student projects",
  "High-school scientific outreach activities",
  "Networking events with engineers, researchers, entrepreneurs, and companies",
] as const;

const PROJECT_SKILLS = [
  "Problem solving",
  "Teamwork",
  "Project management",
  "Communication",
  "Leadership",
  "Research",
  "Creativity",
  "Critical thinking",
  "Presentation",
  "Technical documentation",
] as const;

const PARTNERSHIP_BENEFITS = [
  "Professional workshops",
  "Industry knowledge",
  "Company visits",
  "Mentorship",
  "Technical training",
  "Networking opportunities",
  "Competitions and hackathons",
  "Internship and career opportunities",
  "Real-world engineering challenges",
] as const;

const VALUES = [
  {
    title: "Innovation",
    text: "Encouraging students to think differently and transform ideas into solutions.",
  },
  {
    title: "Learning",
    text: "Promoting continuous learning and knowledge sharing.",
  },
  {
    title: "Practicality",
    text: "Turning theoretical knowledge into practical skills and functional projects.",
  },
  {
    title: "Collaboration",
    text: "Building a community where students work together, share knowledge and support one another.",
  },
  {
    title: "Curiosity",
    text: "Encouraging students to explore new technologies and scientific fields.",
  },
  {
    title: "Leadership",
    text: "Helping students develop the confidence and responsibility required to lead projects and teams.",
  },
  {
    title: "Impact",
    text: "Using science and engineering to create useful solutions and contribute positively to society.",
  },
] as const;

// Sections surfaced by the in-page navigation — order mirrors the page flow.
const SECTION_LINKS = [
  { id: "mission", label: "Mission" },
  { id: "vision", label: "Vision" },
  { id: "areas", label: "Areas of activity" },
  { id: "activities", label: "Activities" },
  { id: "projects", label: "Projects" },
  { id: "outreach", label: "Outreach" },
  { id: "competitions", label: "Competitions" },
  { id: "partnerships", label: "Partnerships" },
  { id: "community", label: "Community" },
  { id: "values", label: "Values" },
  { id: "motto", label: "Motto" },
] as const;

const SECTION_IDS = SECTION_LINKS.map((item) => item.id);

// ─── Small building blocks ───────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-16 md:pb-20">
      {children}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-widest text-brand uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight font-bold md:text-4xl">{title}</h2>
      {lead && <p className="mt-4 max-w-2xl font-semibold text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** Large open pill cloud (matches the "Who we are" chips on the homepage). */
function ChipCloud({ items }: { items: readonly string[] }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3" role="list">
      {items.map((chip, index) => (
        <ScrollReveal key={chip} delay={Math.min(index * 0.05, 0.3)} scale duration={0.3}>
          <span
            role="listitem"
            className="inline-flex rounded-full border border-brand/20 bg-card/70 px-5 py-2.5 text-sm font-bold text-brand-deep transition-colors hover:border-brand/50 hover:bg-brand/5 md:text-base"
          >
            {chip}
          </span>
        </ScrollReveal>
      ))}
    </div>
  );
}

/** Glow-glass floating panel — lighter than hero-glass, used for the nav. */
const navPanelClass =
  "rounded-full bg-white/60 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-white/60 backdrop-blur-xl backdrop-saturate-150";

// ─── Scroll-spy navigation ───────────────────────────────────────────────────

function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      // A narrow band just below the top of the viewport marks "the section
      // you are currently reading".
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function SectionNav() {
  const reduced = useReducedMotion();
  const active = useScrollSpy(SECTION_IDS);
  const [open, setOpen] = useState(false);
  // Only float the pill once the visitor has scrolled past the hero, so it
  // never sits above/over the About WaveZ section right from the start.
  const [pinned, setPinned] = useState(false);
  const activeLabel = SECTION_LINKS.find((item) => item.id === active)?.label ?? "Jump to section";

  // Close the mobile dropdown with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Fade the floating nav in once the hero is off-screen; keep it out of the
  // way before that so headings open the page clean.
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > window.innerHeight * 0.7;
      setPinned((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const pillVisible = pinned
    ? "translate-y-0 opacity-100"
    : "pointer-events-none -translate-y-2 opacity-0";

  return (
    <>
      {/* Mobile / tablet: compact dropdown */}
      <div
        className={`sticky top-3 z-40 mx-auto flex w-full max-w-6xl justify-center px-5 transition-[opacity,transform] duration-300 lg:hidden ${pillVisible}`}
      >
        <div className={`relative w-fit ${navPanelClass} p-1.5`}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span className="max-w-48 truncate">Jump to: {activeLabel}</span>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 text-brand transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
          <AnimatePresence>
            {open && (
              <motion.ul
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: reduced ? 0 : 0.16, ease: "easeOut" }}
                className="absolute top-full left-0 z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-2xl bg-white/80 p-2 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)] ring-1 ring-white/70 backdrop-blur-xl backdrop-saturate-150"
              >
                {SECTION_LINKS.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                        active === item.id
                          ? "bg-brand/10 text-brand"
                          : "text-foreground/70 hover:bg-brand/5 hover:text-brand"
                      }`}
                    >
                      {item.label}
                      {active === item.id && (
                        <Check aria-hidden="true" className="size-4 shrink-0" />
                      )}
                    </a>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop (lg+): centered pill rail with an animated active indicator */}
      <div
        className={`sticky top-3 z-40 mx-auto hidden w-full max-w-6xl px-5 transition-[opacity,transform] duration-300 lg:block ${pillVisible}`}
      >
        <nav
          aria-label="In this page"
          className={`${navPanelClass} flex w-fit max-w-full items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {SECTION_LINKS.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`relative rounded-full px-4 py-2 text-[13px] font-bold whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  isActive ? "text-brand" : "text-foreground/60 hover:text-brand"
                }`}
              >
                {isActive && !reduced && (
                  <motion.span
                    layoutId="about-nav-active"
                    className="absolute inset-0 rounded-full bg-brand/10"
                    transition={{ type: "spring", bounce: 0.16, duration: 0.55 }}
                  />
                )}
                {isActive && reduced && (
                  <span className="absolute inset-0 rounded-full bg-brand/10" />
                )}
                <span className="relative">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-background">
      <SiteHeader />

      {/* Hero — a mini version of the homepage hero: open canvas, ambient glow */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="hero-orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 pb-16 md:pt-20 md:pb-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold text-brand">
              WaveZ Scientific Club
            </span>
            <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.02] font-bold md:text-6xl lg:text-7xl">
              Science, engineering &amp; innovation — built by students.
            </h1>

            {/* "WaveZ in one sentence" — pull-quote treatment */}
            <figure className="relative mt-10 max-w-3xl">
              <span
                aria-hidden="true"
                className="absolute -top-8 -left-3 font-display text-7xl leading-none font-bold text-brand/15 select-none"
              >
                “
              </span>
              <blockquote className="relative font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
                WaveZ Scientific Club is a student-led scientific and technological community at
                Université Djilali Liabès of Sidi Bel Abbès that empowers students to learn, build,
                collaborate, and innovate through practical projects, workshops, competitions, and
                connections with the scientific and professional world.
              </blockquote>
            </figure>

            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold">
              <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-2 text-mint-foreground">
                <CalendarDays aria-hidden="true" className="size-4" />
                Founded 7 October 2025
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-2 text-mint-foreground">
                <MapPin aria-hidden="true" className="size-4" />
                Université Djilali Liabès, Sidi Bel Abbès, Algeria
              </span>
            </div>
          </div>
        </div>
      </section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      <SectionNav />

      {/* Background */}
      <Section id="about">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading
              eyebrow="Who we are"
              title="About WaveZ"
              lead="A student community turning classroom theory into hands-on engineering."
            />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-semibold leading-relaxed text-foreground/80">
              WaveZ Scientific Club is a student-led scientific and technological club based at
              Université Djilali Liabès of Sidi Bel Abbès, Algeria, bringing together students who
              are passionate about science, engineering, technology, innovation, and
              entrepreneurship.
            </p>
            <p className="mt-5 font-semibold leading-relaxed text-foreground/80">
              Founded on <strong>7 October 2025</strong>, WaveZ was created with the ambition of
              building an active student community where theoretical knowledge can be transformed
              into practical skills, real projects, and meaningful experiences.
            </p>
          </ScrollReveal>
        </div>
        <div className="md:ml-[40%]">
          <ScrollReveal delay={0.1}>
            <p className="mt-10 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              Focus fields
            </p>
          </ScrollReveal>
          <ChipCloud items={FIELDS} />
          <ScrollReveal delay={0.1}>
            <p className="mt-8 max-w-2xl font-semibold leading-relaxed text-foreground/75">
              Its activities are designed to complement university education by giving students
              opportunities to learn through experimentation, teamwork, workshops, competitions,
              projects, and interaction with professionals.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Mission */}
      <Section id="mission">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Our purpose" title="Our Mission" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
              To{" "}
              <span className="text-brand">
                develop the scientific, technical, creative, and professional abilities of students
              </span>{" "}
              by creating an environment where they can learn, experiment, build, collaborate, and
              share knowledge.
            </p>
            <p className="mt-6 font-semibold leading-relaxed text-foreground/75">
              The club aims to bridge the gap between academic education and practical experience by
              encouraging students to move beyond theoretical concepts and develop solutions to
              real-world problems.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Vision */}
      <Section id="vision">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Where we're going" title="Our Vision" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
              A strong scientific and technological student community that{" "}
              <span className="text-brand">
                contributes to the development of innovation and engineering culture
              </span>{" "}
              within the university and beyond.
            </p>
            <p className="mt-6 font-semibold leading-relaxed text-foreground/75">
              The long-term vision is to establish WaveZ as a platform where students from different
              disciplines can collaborate on ambitious projects, participate in national and
              international competitions, connect with companies and professionals, and transform
              innovative ideas into concrete projects and initiatives.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      {/* Areas of activity — open grid, no card shells */}
      <Section id="areas">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ScrollReveal>
            <SectionHeading
              eyebrow="What we do"
              title="Main Areas of Activity"
              lead="Eight technical playgrounds where students learn by doing."
            />
          </ScrollReveal>
        </div>
        <div className="mt-12 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((area, index) => (
            <ScrollReveal
              key={area.title}
              delay={Math.min(index * 0.07, 0.35)}
              scale
              duration={0.3}
            >
              <div className="group">
                <p
                  className="text-4xl transition-transform duration-300 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {area.icon}
                </p>
                <h3 className="mt-4 font-display text-lg font-bold text-brand-deep">
                  {area.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed font-semibold text-muted-foreground">
                  {area.text}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* Activities — larger flowing pill cloud */}
      <Section id="activities">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="All year round" title="Activities" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-semibold leading-relaxed text-foreground/80">
              WaveZ organizes a variety of activities throughout the academic year, including:
            </p>
            <ChipCloud items={ACTIVITIES} />
            <p className="mt-8 max-w-2xl font-semibold leading-relaxed text-foreground/75">
              The club places particular importance on <strong>learning by doing</strong>, allowing
              participants to apply what they learn immediately through practical challenges and
              projects.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Projects & Innovation */}
      <Section id="projects">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Build real things" title="Projects &amp; Innovation" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
              From ideas to prototypes — students identify real-world problems, research solutions,
              design, build, and test through an iterative engineering process.
            </p>
            <p className="mt-6 font-semibold leading-relaxed text-foreground/75">
              This project-oriented approach helps students develop not only technical knowledge but
              also important professional skills such as:
            </p>
            <ul className="mt-7 grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {PROJECT_SKILLS.map((skill, index) => (
                <ScrollReveal
                  key={skill}
                  delay={Math.min(index * 0.05, 0.25)}
                  from={16}
                  duration={0.35}
                >
                  <li className="flex items-center gap-3 font-bold text-foreground/85">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-xs text-brand"
                    >
                      ✓
                    </span>
                    {skill}
                  </li>
                </ScrollReveal>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </Section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      {/* Scientific Outreach */}
      <Section id="outreach">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Beyond the university" title="Scientific Outreach" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
              Making science and technology accessible to younger students.
            </p>
            <p className="mt-6 font-semibold leading-relaxed text-foreground/75">
              Through outreach activities and workshops in high schools, the club introduces
              students to subjects such as robotics, electronics, programming, IoT, and engineering.
            </p>
            <p className="mt-5 font-semibold leading-relaxed text-foreground/75">
              The objective is to encourage curiosity and demonstrate that scientific and technical
              fields are not limited to theoretical classroom learning. Students can experiment,
              build, fail, improve, and eventually create things that actually work.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Competitions & Events */}
      <Section id="competitions">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Test your skills" title="Competitions &amp; Events" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-semibold leading-relaxed text-foreground/80">
              WaveZ encourages members to participate in scientific and technological competitions
              at university, national, and potentially international levels.
            </p>
            <p className="mt-5 font-semibold leading-relaxed text-foreground/80">
              The club also organizes its own events and challenges to create opportunities for
              students to test their knowledge, work under constraints, collaborate with others, and
              present their solutions.
            </p>

            {/* Pi Day — a soft-glow highlight, grouped by light rather than a border */}
            <div className="relative mt-10 overflow-hidden rounded-4xl px-6 py-8 md:px-10 md:py-10">
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-4xl bg-linear-to-br from-brand/20 via-cyan-400/15 to-transparent blur-2xl"
              />
              <div className="relative">
                <p className="font-display text-2xl leading-tight font-bold text-brand-deep">
                  🥧 Pi Day Mathematics Olympiad
                </p>
                <p className="mt-3 max-w-xl font-semibold leading-relaxed text-foreground/80">
                  One of the club's initiatives is the organization of a{" "}
                  <strong>Mathematics Olympiad associated with Pi Day</strong>, bringing together
                  high-school and university students in a competitive scientific environment.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Section>

      {/* Partnerships */}
      <Section id="partnerships">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading
              eyebrow="From campus to industry"
              title="Partnerships &amp; Industry Connection"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-semibold leading-relaxed text-foreground/80">
              WaveZ seeks to establish relationships with{" "}
              <strong>
                companies, engineering organizations, technology companies, researchers,
                universities, laboratories, and professional communities
              </strong>
              .
            </p>
            <p className="mt-5 font-semibold leading-relaxed text-foreground/80">
              These partnerships can provide students with access to:
            </p>
            <ChipCloud items={PARTNERSHIP_BENEFITS} />
            <p className="mt-8 max-w-2xl font-semibold leading-relaxed text-foreground/75">
              The club's objective is to create a bridge between{" "}
              <strong>students, academia, and industry</strong>.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Community */}
      <Section id="community">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="More than activities" title="Community" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="font-display text-xl leading-snug font-bold text-brand-deep md:text-2xl">
              A community where students from different backgrounds meet, exchange ideas, and work
              together.
            </p>
            <p className="mt-6 font-semibold leading-relaxed text-foreground/75">
              WaveZ is more than a collection of technical activities. Members are encouraged to
              share knowledge rather than keeping technical skills isolated within individuals.
            </p>
            <p className="mt-5 font-semibold leading-relaxed text-foreground/75">
              The club welcomes students interested in science and technology, regardless of their
              current level. Beginners can discover new fields, while experienced members can deepen
              their knowledge and mentor others.
            </p>
          </ScrollReveal>
        </div>
      </Section>

      {/* Leadership */}
      <Section id="leadership">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <ScrollReveal>
            <SectionHeading eyebrow="Who runs the club" title="Leadership &amp; Organization" />
          </ScrollReveal>
          <ScrollReveal delay={0.12}>
            <p className="max-w-2xl font-semibold leading-relaxed text-foreground/80">
              WaveZ is organized and led by its student officers — the people running competitions,
              workshops and projects every week.
            </p>
            <Link
              to="/"
              hash="leaders"
              className="clay-sm group mt-8 inline-flex items-center gap-2 rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Meet our leadership team
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </ScrollReveal>
        </div>
      </Section>

      <ScrollReveal>
        <BoltDivider />
      </ScrollReveal>

      {/* Core Values — alternating editorial rows, joined by gradient hairlines */}
      <Section id="values">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ScrollReveal>
            <SectionHeading
              eyebrow="What guides us"
              title="Core Values"
              lead="The principles behind every project, workshop and decision."
            />
          </ScrollReveal>
        </div>
        <div className="mt-10 md:mt-14">
          {VALUES.map((value, index) => {
            const flip = index % 2 === 1;
            return (
              <div key={value.title}>
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className="h-px bg-linear-to-r from-transparent via-brand/15 to-transparent"
                  />
                )}
                <ScrollReveal from={22} delay={Math.min(index * 0.05, 0.2)}>
                  <div
                    className={`flex flex-col gap-3 py-8 md:flex-row md:items-center md:gap-10 md:py-10 ${
                      flip ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    <h3 className="md:w-1/2">
                      <span className="block text-xs font-extrabold tracking-widest text-brand/50 uppercase">
                        Value 0{index + 1}
                      </span>
                      <span className="mt-1 block font-display text-3xl font-bold text-brand-deep md:text-4xl">
                        {value.title}
                      </span>
                    </h3>
                    <p className="max-w-xl font-semibold leading-relaxed text-muted-foreground md:w-1/2">
                      {value.text}
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Motto — full visual moment: giant type, centered, ambient glow */}
      <section
        id="motto"
        className="relative scroll-mt-24 overflow-hidden px-5 pt-10 pb-24 md:pb-36"
      >
        <div aria-hidden="true" className="hero-orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <ScrollReveal>
            <p className="text-xs font-extrabold tracking-widest text-brand uppercase">Our Motto</p>
            <h2 className="mt-5 font-display text-5xl leading-[0.95] font-bold md:text-7xl lg:text-8xl">
              Ride the wave.
              <span className="mt-2 block bg-linear-to-r from-brand via-cyan-400 to-mint bg-clip-text text-transparent">
                Build the future.
              </span>
            </h2>
            <p className="mx-auto mt-7 max-w-xl text-base font-semibold text-foreground/75">
              The idea at the heart of everything WaveZ does — learn together, build real things,
              and innovate beyond the classroom.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

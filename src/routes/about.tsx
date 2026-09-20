import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";

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

// ─── Small building blocks ───────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-6 px-5">
      <ScrollReveal>{children}</ScrollReveal>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-widest text-brand uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">{title}</h2>
    </div>
  );
}

const bodyClass = "mt-4 max-w-3xl text-base font-semibold leading-relaxed text-foreground/80";

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`clay-sm rounded-3xl bg-card p-6 ${className}`}>{children}</div>;
}

const TOC = [
  { href: "#mission", label: "Mission" },
  { href: "#vision", label: "Vision" },
  { href: "#areas", label: "Areas of activity" },
  { href: "#activities", label: "Activities" },
  { href: "#projects", label: "Projects" },
  { href: "#outreach", label: "Outreach" },
  { href: "#competitions", label: "Competitions" },
  { href: "#partnerships", label: "Partnerships" },
  { href: "#community", label: "Community" },
  { href: "#values", label: "Values" },
] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pt-12 pb-16 md:pt-16">
        <div aria-hidden="true" className="hero-orbs">
          <span className="hero-orb hero-orb--a" />
          <span className="hero-orb hero-orb--b" />
        </div>
        <div className="relative z-10">
          <ScrollReveal>
            <div className="hero-glass max-w-3xl rounded-4xl p-8 md:p-12">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1.5 text-xs font-extrabold text-brand">
                WaveZ Scientific Club
              </span>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold md:text-6xl">
                Science, engineering &amp; innovation — built by students.
              </h1>
              <p className="mt-5 text-base font-semibold leading-relaxed text-foreground/75 md:text-lg">
                WaveZ Scientific Club is a student-led scientific and technological community at
                Université Djilali Liabès of Sidi Bel Abbès that empowers students to learn, build,
                collaborate, and innovate through practical projects, workshops, competitions, and
                connections with the scientific and professional world.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
                <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-1.5 text-mint-foreground">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  Founded 7 October 2025
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-mint/25 px-4 py-1.5 text-mint-foreground">
                  <MapPin aria-hidden="true" className="size-4" />
                  Université Djilali Liabès, Sidi Bel Abbès, Algeria
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* In-page navigation */}
      <div className="sticky top-3 z-20 mx-auto max-w-6xl px-5">
        <ScrollReveal>
          <nav
            aria-label="In this page"
            className="hero-glass flex gap-1 overflow-x-auto rounded-full p-1.5"
          >
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </ScrollReveal>
      </div>

      <div className="mt-12 space-y-16 pb-20">
        <ScrollReveal>
          <BoltDivider />
        </ScrollReveal>

        {/* Background */}
        <Section id="about">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Who we are" title="About WaveZ" />
            <p className={bodyClass}>
              WaveZ Scientific Club is a student-led scientific and technological club based at
              Université Djilali Liabès of Sidi Bel Abbès, Algeria, bringing together students who
              are passionate about science, engineering, technology, innovation, and
              entrepreneurship.
            </p>
            <p className={bodyClass}>
              Founded on <strong>7 October 2025</strong>, WaveZ was created with the ambition of
              building an active student community where theoretical knowledge can be transformed
              into practical skills, real projects, and meaningful experiences.
            </p>
            <p className={bodyClass}>
              The club focuses particularly on Electrical Engineering, Artificial Intelligence,
              Autonomous Systems, Robotics, Internet of Things (IoT), Embedded Systems, Electronics,
              PCB Design, 3D Design, and emerging technologies. Its activities are designed to
              complement university education by giving students opportunities to learn through
              experimentation, teamwork, workshops, competitions, projects, and interaction with
              professionals.
            </p>
          </div>
        </Section>

        <ScrollReveal>
          <BoltDivider />
        </ScrollReveal>

        {/* Mission */}
        <Section id="mission">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Our purpose" title="Our Mission" />
            <p className={bodyClass}>
              WaveZ's mission is to{" "}
              <strong>
                develop the scientific, technical, creative, and professional abilities of students
              </strong>{" "}
              by creating an environment where they can learn, experiment, build, collaborate, and
              share knowledge.
            </p>
            <p className={bodyClass}>
              The club aims to bridge the gap between academic education and practical experience by
              encouraging students to move beyond theoretical concepts and develop solutions to
              real-world problems.
            </p>
          </div>
        </Section>

        {/* Vision */}
        <Section id="vision">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Where we're going" title="Our Vision" />
            <p className={bodyClass}>
              WaveZ aspires to become a strong scientific and technological student community that
              contributes to the development of innovation and engineering culture within the
              university and beyond.
            </p>
            <p className={bodyClass}>
              The long-term vision is to establish WaveZ as a platform where students from different
              disciplines can collaborate on ambitious projects, participate in national and
              international competitions, connect with companies and professionals, and transform
              innovative ideas into concrete projects and initiatives.
            </p>
          </div>
        </Section>

        <ScrollReveal>
          <BoltDivider />
        </ScrollReveal>

        {/* Areas of activity */}
        <Section id="areas">
          <div>
            <SectionHeading eyebrow="What we do" title="Main Areas of Activity" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {AREAS.map((area, index) => (
                <ScrollReveal key={area.title} delay={Math.min(index * 0.06, 0.3)}>
                  <GlassCard className="h-full">
                    <p className="text-3xl" aria-hidden="true">
                      {area.icon}
                    </p>
                    <h3 className="mt-3 font-display text-lg font-bold">{area.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed font-semibold text-muted-foreground">
                      {area.text}
                    </p>
                  </GlassCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </Section>

        {/* Activities */}
        <Section id="activities">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="All year round" title="Activities" />
            <p className={bodyClass}>
              WaveZ organizes a variety of activities throughout the academic year, including:
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {ACTIVITIES.map((activity) => (
                <li
                  key={activity}
                  className="rounded-full border border-brand/20 bg-card/70 px-4 py-1.5 text-sm font-bold text-brand-deep"
                >
                  {activity}
                </li>
              ))}
            </ul>
            <p className={bodyClass}>
              The club places particular importance on <strong>learning by doing</strong>, allowing
              participants to apply what they learn immediately through practical challenges and
              projects.
            </p>
          </div>
        </Section>

        {/* Projects & Innovation */}
        <Section id="projects">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Build real things" title="Projects &amp; Innovation" />
            <p className={bodyClass}>
              WaveZ encourages members to transform ideas into prototypes and functional solutions.
            </p>
            <p className={bodyClass}>
              Students are encouraged to identify real-world problems, research possible solutions,
              design systems, develop prototypes, test them, and improve their work through an
              iterative engineering process.
            </p>
            <p className={bodyClass}>
              This project-oriented approach helps students develop not only technical knowledge but
              also important professional skills such as:
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {PROJECT_SKILLS.map((skill) => (
                <li key={skill} className="flex items-center gap-2 font-bold text-foreground/85">
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs text-brand"
                  >
                    ✓
                  </span>
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <ScrollReveal>
          <BoltDivider />
        </ScrollReveal>

        {/* Scientific Outreach */}
        <Section id="outreach">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Beyond the university" title="Scientific Outreach" />
            <p className={bodyClass}>
              WaveZ also aims to make science and technology more accessible to younger students.
            </p>
            <p className={bodyClass}>
              Through outreach activities and workshops in high schools, the club introduces
              students to subjects such as robotics, electronics, programming, IoT, and engineering.
            </p>
            <p className={bodyClass}>
              The objective is to encourage curiosity and demonstrate that scientific and technical
              fields are not limited to theoretical classroom learning. Students can experiment,
              build, fail, improve, and eventually create things that actually work.
            </p>
          </div>
        </Section>

        {/* Competitions & Events */}
        <Section id="competitions">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Test your skills" title="Competitions &amp; Events" />
            <p className={bodyClass}>
              WaveZ encourages members to participate in scientific and technological competitions
              at university, national, and potentially international levels.
            </p>
            <p className={bodyClass}>
              The club also organizes its own events and challenges to create opportunities for
              students to test their knowledge, work under constraints, collaborate with others, and
              present their solutions.
            </p>
            <div className="mt-6 rounded-3xl border border-brand/20 bg-brand/10 px-6 py-5">
              <p className="font-display text-lg font-bold text-brand-deep">
                🥧 Pi Day Mathematics Olympiad
              </p>
              <p className="mt-1.5 font-semibold text-foreground/80">
                One of the club's initiatives is the organization of a{" "}
                <strong>Mathematics Olympiad associated with Pi Day</strong>, bringing together
                high-school and university students in a competitive scientific environment.
              </p>
            </div>
          </div>
        </Section>

        {/* Partnerships */}
        <Section id="partnerships">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading
              eyebrow="From campus to industry"
              title="Partnerships &amp; Industry Connection"
            />
            <p className={bodyClass}>
              WaveZ seeks to establish relationships with{" "}
              <strong>
                companies, engineering organizations, technology companies, researchers,
                universities, laboratories, and professional communities
              </strong>
              .
            </p>
            <p className={bodyClass}>These partnerships can provide students with access to:</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {PARTNERSHIP_BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-full border border-brand/20 bg-card/70 px-4 py-1.5 text-sm font-bold text-brand-deep"
                >
                  {benefit}
                </li>
              ))}
            </ul>
            <p className={bodyClass}>
              The club's objective is to create a bridge between{" "}
              <strong>students, academia, and industry</strong>.
            </p>
          </div>
        </Section>

        {/* Community */}
        <Section id="community">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="More than activities" title="Community" />
            <p className={bodyClass}>
              WaveZ is more than a collection of technical activities. It aims to create a community
              in which students from different backgrounds can meet, exchange ideas, learn from one
              another, and work together.
            </p>
            <p className={bodyClass}>
              Members are encouraged to share knowledge rather than keeping technical skills
              isolated within individuals.
            </p>
            <p className={bodyClass}>
              The club welcomes students interested in science and technology, regardless of their
              current level. Beginners can discover new fields, while experienced members can deepen
              their knowledge and mentor others.
            </p>
          </div>
        </Section>

        {/* Leadership — official list is empty, so link to the live team carousel */}
        <Section id="leadership">
          <div className="hero-glass rounded-4xl p-8 md:p-12">
            <SectionHeading eyebrow="Who runs the club" title="Leadership &amp; Organization" />
            <p className={bodyClass}>
              WaveZ is organized and led by its student officers — the people running competitions,
              workshops and projects every week.
            </p>
            <Link
              to="/"
              hash="leaders"
              className="group mt-6 inline-flex items-center gap-2 rounded-xl font-display text-lg font-bold text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Meet our leadership team
              <ArrowRight
                aria-hidden="true"
                className="size-5 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Section>

        <ScrollReveal>
          <BoltDivider />
        </ScrollReveal>

        {/* Core Values */}
        <Section id="values">
          <div>
            <SectionHeading eyebrow="What guides us" title="Core Values" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {VALUES.map((value, index) => (
                <ScrollReveal key={value.title} delay={Math.min(index * 0.06, 0.3)}>
                  <GlassCard className="h-full">
                    <h3 className="font-display text-xl font-bold text-brand-deep">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed font-semibold text-muted-foreground">
                      {value.text}
                    </p>
                  </GlassCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </Section>

        {/* Motto banner */}
        <Section id="motto">
          <ScrollReveal>
            <div className="hero-glass rounded-4xl px-8 py-14 text-center md:py-20">
              <p className="text-xs font-extrabold tracking-widest text-brand uppercase">
                Our Motto
              </p>
              <p className="mt-3 font-display text-5xl leading-none font-bold md:text-7xl">
                Ride the wave. Build the future.
              </p>
              <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-foreground/75">
                The idea at the heart of everything WaveZ does — learn together, build real things,
                and innovate beyond the classroom.
              </p>
            </div>
          </ScrollReveal>
        </Section>
      </div>

      <SiteFooter />
    </div>
  );
}

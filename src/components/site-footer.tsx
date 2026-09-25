import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";

import logo from "@/assets/wavez-logo.png";

/**
 * Club's official public mailbox (CLUB_EMAIL in env, see AGENTS.md). Public
 * contact info — safe to render. Falls back to the documented address if a
 * VITE_CLUB_EMAIL override is ever added.
 */
const CLUB_EMAIL = import.meta.env["VITE_CLUB_EMAIL"] ?? "wavezclub22@gmail.com";

/** Explore column — quick navigational links. */
const EXPLORE_LINKS: ReadonlyArray<{ to: "/" | "/about"; hash?: string; label: string }> = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/", hash: "leaders", label: "Team" },
  { to: "/", hash: "news", label: "Events" },
];

/** Current official brand marks (Font Awesome 6 brand glyphs) as inline SVGs. */
const SOCIALS = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/wavez-club-6a97533b9?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
    path: "M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/wavez.club?stkn=dzFuYjB1Y3ZiOXR0",
    path: "M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/18JP4W77X4/?mibextid=wwXIfr",
    path: "M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z",
  },
] as const;

const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-xl px-3 py-3 text-sm font-bold text-foreground/70 transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand/10 bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        {/* Final call-to-action — the last chance to steer a leaving visitor. */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl leading-tight font-bold text-brand-deep md:text-4xl">
              Ready to join the wave?
            </h2>
            <p className="mt-3 text-lg font-semibold text-foreground/70">
              Open registrations are live — pick a campaign and apply in minutes.
            </p>
          </div>
          <Link
            to="/"
            hash="join"
            className="cta-pulse clay-md group inline-flex w-fit items-center gap-2 rounded-2xl bg-brand px-8 py-4 text-base font-bold text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Apply now
            <ArrowRight
              aria-hidden="true"
              className="size-5 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* Columns — focal brand block, then organized quick links + socials. */}
        <div className="mt-14 grid gap-12 border-t border-brand/10 pt-14 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)] md:gap-10">
          {/* Focal column — logo + tagline + direct contact (single touchpoint). */}
          <div>
            <Link
              to="/"
              aria-label="Wavez Club home"
              className="inline-block rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <img src={logo} alt="Wavez Club logo" width={112} height={112} className="shrink-0" />
            </Link>
            <p className="mt-5 font-display text-xl leading-snug font-bold text-brand-deep">
              Ride the wave. Build the future.
            </p>
            <p className="mt-3 max-w-sm text-[17px] leading-relaxed font-semibold text-foreground/75">
              WaveZ Scientific Club is a student-led scientific and technological community at
              Université Djilali Liabès of Sidi Bel Abbès — turning classroom theory into real
              projects, workshops and competitions.
            </p>
            <a
              href={`mailto:${CLUB_EMAIL}`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand transition-colors hover:text-brand-deep focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              {CLUB_EMAIL}
            </a>
          </div>

          {/* Quick nav — grouped, not a flat row. */}
          <nav aria-label="Explore" className="md:justify-self-center">
            <h3 className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              Explore
            </h3>
            <ul className="mt-4 flex flex-col gap-1">
              {EXPLORE_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    {...(item.hash ? { hash: item.hash } : {})}
                    className={LINK_CLASS}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Get involved + Connect — the conversion block. */}
          <div>
            <div>
              <h3 className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
                Get involved
              </h3>
              <ul className="mt-4 flex flex-col gap-1">
                <li>
                  <Link to="/" hash="join" className={LINK_CLASS}>
                    Register for a campaign
                  </Link>
                </li>
                <li>
                  <Link to="/about" className={LINK_CLASS}>
                    Learn about the club
                  </Link>
                </li>
              </ul>
            </div>
            <h3 className="mt-8 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              Connect
            </h3>
            <div className="mt-4 flex items-center gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  title={social.name}
                  className="grid size-12 place-items-center rounded-full border border-foreground/25 text-foreground/55 transition-all duration-200 hover:scale-105 hover:border-brand hover:text-brand hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <svg viewBox="0 0 448 512" aria-hidden="true" className="size-5 fill-current">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar — tidy, no dead space. */}
        <div className="mt-12 flex flex-col items-center gap-2 border-t border-foreground/10 pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-left">
          <p className="text-xs font-semibold text-muted-foreground">
            © {year} Wavez Club. All rights reserved.
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            Faculty of Electrical Engineering · Sidi Bel Abbès
          </p>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "@tanstack/react-router";

import logo from "@/assets/wavez-logo.png";

type FooterLink = {
  to: "/" | "/about";
  hash?: string;
  label: string;
};

const NAV_LINKS: FooterLink[] = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/", hash: "news", label: "Events" },
  { to: "/", hash: "join", label: "Registrations" },
  { to: "/", hash: "leaders", label: "Our Leaders" },
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
    path: "M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/18JP4W77X4/?mibextid=wwXIfr",
    path: "M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z",
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand/10 bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-14">
        {/* Top block — centered logo + short real description */}
        <div className="flex flex-col items-center text-center">
          <Link
            to="/"
            aria-label="Wavez Club home"
            className="rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <img src={logo} alt="Wavez Club logo" width={80} height={80} className="shrink-0" />
          </Link>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed font-semibold text-foreground/75">
            WaveZ Scientific Club is a student-led scientific and technological community at
            Université Djilali Liabès of Sidi Bel Abbès. We empower students to learn, build,
            collaborate, and innovate through practical projects, workshops, competitions, and
            connections with the scientific and professional world.
          </p>
        </div>

        {/* Middle row — centered nav links */}
        <nav aria-label="Footer" className="mt-9 flex flex-wrap items-center justify-center gap-1">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              {...(item.hash ? { hash: item.hash } : {})}
              className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom bar — dynamic copyright left, social circles right */}
        <div className="mt-10 flex flex-col items-center gap-7 border-t border-brand/10 pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs font-semibold text-muted-foreground">
            © {year} Wavez Club. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {SOCIALS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                title={social.name}
                className="grid size-11 place-items-center rounded-full border border-foreground/25 text-foreground/55 transition-colors hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <svg viewBox="0 0 448 512" aria-hidden="true" className="size-[18px] fill-current">
                  <path d={social.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

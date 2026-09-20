import { Link, useLocation } from "@tanstack/react-router";
import logo from "@/assets/wavez-logo.png";

const NAV_ITEMS: ReadonlyArray<{ to: "/" | "/about"; hash?: string; label: string }> = [
  { to: "/about", label: "About" },
  { to: "/", hash: "leaders", label: "Team" },
  { to: "/", hash: "news", label: "Events" },
  { to: "/", hash: "join", label: "Join" },
];

export function SiteHeader() {
  const { pathname } = useLocation();

  return (
    <header className="mx-auto max-w-6xl px-5 pt-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <img src={logo} alt="Wavez Club logo" width={96} height={96} className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-none font-bold text-brand-deep">
              Wavez
            </p>
            <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground">
              Club
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 text-sm font-bold md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  {...(item.hash ? { hash: item.hash } : {})}
                  className={`rounded-xl px-4 py-2 ${
                    isActive ? "text-brand" : "text-muted-foreground hover:text-brand"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

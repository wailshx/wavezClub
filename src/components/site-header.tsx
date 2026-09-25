import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

import logo from "@/assets/wavez-logo.png";

const NAV_ITEMS: ReadonlyArray<{ to: "/" | "/about"; hash?: string; label: string }> = [
  { to: "/about", label: "About" },
  { to: "/", hash: "leaders", label: "Team" },
  { to: "/", hash: "news", label: "Events" },
  { to: "/", hash: "join", label: "Join" },
];

export function SiteHeader() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer when the route changes (hash-only jumps close via onClick).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll and close on Escape while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

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
                  className={`rounded-xl px-4 py-3 ${
                    isActive ? "text-brand" : "text-muted-foreground hover:text-brand"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            className="grid size-11 place-items-center rounded-xl border border-brand/20 bg-card/60 text-brand shadow-sm transition-colors hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          id="mobile-nav"
          className={`absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-1 border-l border-brand/10 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-lg font-bold text-brand-deep">Menu</p>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="grid size-11 place-items-center rounded-xl border border-brand/20 text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  {...(item.hash ? { hash: item.hash } : {})}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground hover:bg-brand/5 hover:text-brand"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-1" />
        </aside>
      </div>
    </header>
  );
}

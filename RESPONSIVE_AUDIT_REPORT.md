# Responsive Audit Report — Wavez Club

**Date:** 2026-09-20 · **Scope:** Public site (`/`, `/about`, `/register/<campaign>`) + admin panel (`/gestion/admin`) · **Method:** code review + programmatic layout probes (headless Chromium) at 375 / 430 / 768 / 1024 / 1280 / 1920.

> ⚠️ Admin panel was audited **code-based only** (no credentials available, and `.env`/`.env.local` both point at the **production** Supabase project — no test auth was created). Pre-auth `/gestion` sign-in page was screenshotted as stand-in.

---

## Issues found & fixed

| # | Issue (breakpoint · section) | Fix |
|---|---|---|
| 1 | Leaders marquee had **no touch pause** — scroll paused only on hover/focus-within (touch: never) | `leaders-carousel.tsx`: pause on `pointerdown`, auto-resume 3.5 s after `pointerup`/`pointerleave`/`pointercancel`, toggling `.is-paused`. `styles.css`: added `.leaders-marquee.is-paused .leaders-rail { animation-play-state: paused }`. Reduced-motion fallback unchanged. |
| 2 | **No header navigation below 768 px** — nav was `hidden md:flex`; phones saw logo only (checklist: hero «logo/nav») | `site-header.tsx`: added a mobile drawer — `md:hidden` hamburger (44×44), right slide-in panel with About/Team/Events/Join, backdrop dismiss, Escape close, body-scroll lock, closes on route change. 0 overflow. |
| 3 | **Footer nav links 36 px tall** — below the 44 px touch-target guideline (`Home/About/Events/Registrations/Our Leaders`) | `site-footer.tsx`: nav links bumped `py-2` → `py-3` (44 px). Social icons were already 44 px (`size-11`). |
| 4 | **Admin sidebar showed the desktop icon rail on tablets** — drawer gated at `lg:` (1024), so tablet landscape 1024 got the slim rail instead of the drawer | `gestion.admin.tsx`: all sidebar breakpoints bumped `lg:` → `xl:` (1280): mobile topbar, backdrop, drawer, drawer-close, desktop rail, main padding (`xl:pl-20`). Tablets 768/1024 now use the drawer; icon rail reserved for ≥1280. |

## Probes — horizontal overflow = 0 everywhere (post-fix)

`home / about / register / gestion` run at 375/768/1024/1280/1920 + register wizard steps walked at 375/430/768 — **0 overflow, 0 offenders, 0 text-clipped** on every page/width.

| Page | 375 | 768 | 1024 | 1280 | 1920 |
|---|---|---|---|---|---|
| Home | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 |
| About | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 |
| Register (live campaign) | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 |
| Gestion (sign-in) | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 | ✓ 0 |

## Checked — passed, no change needed

- **Hero:** orbs are `pointer-events: none` + `aria-hidden` (never intercept CTA/text); CTA wraps inside container; logo + new hamburger stable.
- **«Who we are» / asymmetric radius, mentors grid:** columns reflow 1→2 (md), long names wrap — 0 text clipping.
- **Leaders marquee:** masked edges, no page overflow (rail exempt by design); now pauses on touch.
- **Events/registration cards:** 1→2 cols at md; «Apply now» pill never overflows.
- **Logo grid & footer:** stack on mobile; all footer targets ≥44 px.
- **Registration wizard** (live open campaign «New Members — 2026 Season»): stepper labels fit at 375, dropzone + file chips responsive, cut-off fields usable, careful Next/Back flow walked — 0 clipping.
- **/about sticky sub-nav:** no horizontal scroll, sticky pattern intact.
- **Admin dashboard (code-based):** bento reflows `md:grid-cols-6 lg:grid-cols-12`; charts use `ResponsiveContainer` (never fixed-width); members & registrations tables are in `overflow-x-auto` with `min-w-[760px]` (page itself never scrolls horizontally); admin permission toggles sit in `max-w-md` sheet rows that fit at 375; side-sheets `max-w-md`, modals scroll internally. Sidebar now drawer-on-tablet.

## Verification

- `npx tsc --noEmit` → **0 errors**
- `npm run lint` → **0 errors**
- `npm run build` → **0 errors**

## Screenshots (after-only, for review — nothing committed)

Path: `.audit-shots/`

| File | Breakpoint | Page |
|---|---|---|
| `home-375.png` | 375×812 | Homepage |
| `home-768.png` | 768×1024 | Homepage |
| `home-1440.png` | 1440×900 | Homepage |
| `gestion-375.png` | 375×812 | /gestion sign-in (admin stand-in) |
| `gestion-768.png` | 768×1024 | /gestion sign-in (admin stand-in) |
| `gestion-1440.png` | 1440×900 | /gestion sign-in (admin stand-in) |

> Admin dashboard screenshots were intentionally **not** taken: they would require touching the production Supabase auth. The admin panel audit is code-based (see above). If you want real dashboard shots, provide credentials or approve a disposable test admin (create via service role → screenshot → delete).

---

# Round 2 — Footer redesign + Events & Registrations as announcements

## TASK 1 — Footer (`src/components/site-footer.tsx`)

Redesigned for bigger brand presence and a clear hierarchy, with dead space removed:

- **Final CTA band** at the top of the footer: "Ready to join the wave?" + a large, pulsing **Apply now** button linking to open registrations (`/#join`).
- **Three-column layout** (desktop) instead of a flat centered stack:
  1. **Focal column** — larger logo (112px), tagline "Ride the wave. Build the future.", larger description text, and `CLUB_EMAIL` mailto link.
  2. **Explore** — organized vertical quick-nav (Home / About / Team / Events).
  3. **Get involved + Connect** — campaign registration link + social icons.
- **Social icons enlarged** from 44px → 48px circles with a clearer hover state (scale + brand color + glow shadow).
- **Spacing tightened**: consistent gaps, borders used once between band/columns/bottom-bar, fewer leftover gaps from the old centered layout.
- **Touch targets**: all footer links ≥44px; socials 48px (verified at 375).

## TASK 2 — Events & Registrations elevated (`src/routes/index.tsx` + `src/styles.css`)

- **"What's Happening"** — Events section retitled, eyebrow "Announcements", heading scaled to `text-4xl/5xl` as a landmark.
- **Featured announcement**: the single most urgent upcoming event (soonest within 7 days) is moved first and gets a larger treatment — bigger title/body, pill badge, **countdown badge** (`Today` / `Tomorrow` / `In X days`) and a pulsing **Register now** CTA (links to open registrations). Other posts keep the existing treatment.
- **"Join an open registration"** — Registrations retitled with an **OPEN NOW pulse badge** in the heading (`text-4xl/5xl`).
- **Featured campaign**: first open campaign gets a hero-within-section treatment — larger title/description, "OPEN NOW" pill with pulse, and a bigger **pulsing Apply now** button. Remaining campaigns keep the standard card treatment (`Open · #2…`).
- **Decisive closed state**: when no campaigns are open, section header flips to "Registrations closed right now" and the empty state is muted/collapsed with a `Closed` pill.
- **`cta-pulse` glow** added in `styles.css`: blurred halo behind the featured CTAs (static when `prefers-reduced-motion: reduce`). No boxed cards reintroduced anywhere.

## Verification (Round 2)

- `npx tsc --noEmit` → **0 errors** · `npm run lint` → **0 errors** · `npm run build` → **0 errors**
- Horizontal overflow **0** at 375/768/1024/1280/1440/1920 on `/` (redesigned footer + sections), and `/about`, `/register` with the new footer.
- Footer touch targets ≥44px verified at 375.

## Screenshots for review — `.audit-shots/` (`v2-*`)

| File | Breakpoint | Shows |
|---|---|---|
| `v2-home-375.png` / `v2-home-768.png` / `v2-home-1440.png` | full page | entire homepage incl. footer |
| `v2-events-375.png` / `v2-events-1440.png` | section focus | "What's Happening" + featured event |
| `v2-registrations-375.png` / `v2-registrations-1440.png` | section focus | "Open Now" + featured campaign |
| `v2-footer-375.png` / `v2-footer-1440.png` | section focus | redesigned footer (mobile + desktop) |

Nothing committed — please review and let me know if you'd like any tweaks before I commit.
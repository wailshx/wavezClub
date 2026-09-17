# Wavez Club

Official website for the Wavez Club — a student-led scientific club at the Faculty of Electrical Engineering, Djillali Liabès University of Sidi Bel Abbès.

The site has two parts:

- **Public homepage** — club description, upcoming events and news, and a membership registration form.
- **Admin panel** — full control over club members (id, name, age, specialty, department, level L1–L2–L3–M1–M2) and the posts shown on the homepage. Every action goes through server APIs, and only users with the `admin` role can access it. The first account created becomes the admin.

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19 + TanStack Router
- [Supabase](https://supabase.com) (auth, Postgres, RLS)
- Tailwind CSS v4
- Deployed via the Vite/Nitro/Cloudflare pipeline

## Development

Requires Node.js. Install with nvm, then:

```sh
npm i
npm run dev
```

Environment: copy the keys from the Supabase project into your `.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_*`). For local admin server functions, also set `SUPABASE_SERVICE_ROLE_KEY` (never commit it).

### Database migrations

SQL migrations live in `drizzle/migrations/` and are mirrored to `supabase/migrations/` for Supabase CLI tooling. The live project is `pnqdtozfqzvybewuabwc` (see `supabase/config.toml`). Apply pending migrations via the Supabase Dashboard SQL Editor in journal order until `supabase link` is configured — see `AGENTS.md` for details.

## Commands

```sh
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint
npm run format     # prettier
```

## Notes for contributors

- Do not edit generated files under `src/integrations/supabase/**` or `src/routeTree.gen.ts`.
- The admin API lives in `src/lib/admin-api.ts`. It runs on the server only — the import-protection plugin blocks any client import matching `**/server/**`.
- Verify changes with `npx tsc --noEmit`, `npm run lint`, and `npm run build` (0 errors).

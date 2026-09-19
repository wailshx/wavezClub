# AGENTS.md

## Setup

- Repo uses `bun.lock`. Don't commit a generated `package-lock.json`.
- Dev server: `npm run dev`. Route files regenerate `src/routeTree.gen.ts` automatically.

## Database migrations

**Source of truth:** `drizzle/migrations/` (journal: `drizzle/migrations/meta/_journal.json`).

**Supabase CLI mirror:** the same SQL files are copied to `supabase/migrations/` so `supabase db push` / diff tooling can target the correct project (`supabase/config.toml` → `pnqdtozfqzvybewuabwc`, matching `.env`).

Until the Supabase CLI is linked to this project (`supabase link --project-ref pnqdtozfqzvybewuabwc`), apply new migrations **manually** via the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/pnqdtozfqzvybewuabwc/sql/new) — paste each file in journal order (`0000` … `0004`). After editing a migration in `drizzle/migrations/`, re-copy it to `supabase/migrations/` before applying.

| Migration | Purpose |
|---|---|
| `0000_create_members_and_roles.sql` | `members`, `user_roles`, RLS, bootstrap trigger |
| `0001_create_posts.sql` | `posts` table + RLS |
| `0002_admin_requests_and_roles.sql` | `admin_role` enum, `admin_requests`, rate-limit trigger |
| `0003_member_blocking.sql` | `members.blocked_until` |
| `0004_admin_email_drafts.sql` | `admin_email_drafts` table + RLS |

## Verification

Every change must pass, 0 errors:

```sh
npx tsc --noEmit
npm run lint
npm run build
```

## Conventions

- Never edit generated files: `src/integrations/supabase/**` and `src/routeTree.gen.ts`.
- The admin API lives in `src/lib/admin-api.ts` and `src/lib/admin-gestion-api.ts` (server-only functions). Client imports that match `**/server/**` are blocked by the import-protection plugin — keep it under `src/lib/`.
- Server-only env access (`src/lib/*.server.ts`) must be imported via `await import()` from server function handlers — never at module scope in client-compiled modules.
- Keep the working branch green; commits sync to the connected production Git remote.

## Environment Variables

### Committed in `.env` (public / non-secret)

| Variable | Notes |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Lovable Cloud Supabase prod URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key |
| `OWNER_EMAIL` / `VITE_OWNER_EMAIL` | `wailkr68@gmail.com` — trusted club owner |
| `CLUB_EMAIL` | `wavezclub22@gmail.com` — club's public mailbox. Used as the Resend `replyTo` and as the `From` once it points at a verified-domain address (Resend cannot send *from* gmail.com) |

### Must be set in Lovable production env (NOT committed)

| Variable | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Used by `client.server.ts` (bypasses RLS for admin operations) |
| `ADMIN_REQUEST_SIGNING_SECRET` | HMAC signing key for accept/cancel tokens (falls back to insecure dev default locally) |
| `RESEND_API_KEY` | Resend API key for real email sends (owner alert, rejection, member emails) — **secret; do not commit** |
| `RESEND_FROM` | Optional sender override (e.g. `Wavez Club <no-reply@wavez.club>`). Defaults to the temporary `onboarding@resend.dev` until a verified domain is configured |

## Admin Request Flow (Phase 1)

### Migration `drizzle/migrations/0002_admin_requests_and_roles.sql`

Auto-applies on Lovable deploy. Creates:
- `admin_role` enum (president … vice_hr_leader)
- `admin_requests` table with RLS: public INSERT, owner SELECT/UPDATE via service role
- `rate_limit_admin_requests` trigger: 1 request per email per 60 s
- Adds `admin_role` column to `user_roles`
- Drops the old `bootstrap_first_admin` trigger (replaced by app-level owner auto-approve)

### Server functions (`src/lib/admin-gestion-api.ts`)

| Export | Auth | Purpose |
|---|---|---|
| `submitAdminRequestAction` | Public (anon client) | Insert pending request + stub email with accept/cancel token links |
| `ensureOwnerAdmin` | Auth middleware | On every `_authenticated` entry, if signed-in email matches `OWNER_EMAIL`, insert the `president` role if missing |
| `decideAdminRequestAction` | Token-authenticated | Accept: create user_roles + Supabase invite. Cancel: mark rejected + stub rejection email |

### Token flow

Email links: `{origin}/gestion?token=<signed>`  
Token payload: `requestId:accept|cancel:expiresAtMs` signed with HMAC-SHA256  
Single-use enforced by DB status check; expires after 7 days.

### /gestion page modes

- **signin** (default): owner + approved admins sign in.
- **request** (toggled via "Apply for a club role"): collects first/last name, department, email, phone. Calls `submitAdminRequestAction`. Shows persistent confirmation card on success.
- **owner-setup**: owner-only account creation (signs up only if email matches `OWNER_EMAIL`, else steers to request form).

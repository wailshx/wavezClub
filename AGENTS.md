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
| `0015_dashboard_stats.sql` | `get_dashboard_stats` SECURITY DEFINER RPC (SQL-side dashboard aggregation) + aggregate-support indexes |
| `0016_submission_announcements.sql` | Retires the `event`/`news` announcement kinds — `post_kind` is rebuilt as `('registration')`; adds `posts.submission_type`, `posts.subtitle`, `posts.is_pinned`; refreshes the `get_dashboard_stats` announcement series |
| `0018_members_unique_email.sql` | Unique index on `lower(members.email)`. Accepting a submission writes a `members` row and the same person can apply to an open day *and* an event; without the constraint both accepts succeed. The migration refuses to run and lists the conflicting rows rather than deduping |
| `0017_post_campaign_link.sql` | Adds `posts.campaign_id` → `registration_campaigns(id) ON DELETE SET NULL` + index. The announcement *is* the registration entry point, so each one points at the single campaign it announces |

### Announcements = submissions only

`posts` is no longer a news feed. The `event` and `news` kinds are gone from the
database, the public site and the admin console. Every announcement now exists to
announce a submission (`submission_type`: `'openday' | 'event'`), and the
application form lives **inside the card** — there is no separate registration
page anywhere, public or admin.

There is no shared campaign list on the homepage any more — the `#join` section
and every `hash="join"` link are gone. `submission_type` is bound to the
campaign kind through `CAMPAIGN_KIND_FOR_SUBMISSION`:

| Announcement | Campaign `kind` | Form the student gets |
|---|---|---|
| `openday` | `membership` | Membership wizard — 3 steps: profile, school certificate + ID card upload, custom questions |
| `event` | `event` | Event form — single step, details only, no documents |

The link is **nullable on purpose**: an announcement can be written before its
campaign exists. The public card resolves `campaign_id` against
`list_open_campaigns`, and renders a non-clickable "Registration opening soon"
state when the link is missing *or* the campaign is closed — never a dead link
into "This registration has closed". `savePost` re-validates the
announcement-type ↔ campaign-kind pair server-side, because the admin picker is
filtered client-side and a stale tab can still submit a mismatch.

| Piece | Path |
|---|---|
| Domain vocabulary (types, labels, CTA copy, kind mapping) | `src/lib/announcements.ts` |
| Public card (Submit button + form disclosure live here) | `src/components/submission-announcement-card.tsx` |
| Both student forms (extracted from the deleted `/register` route) | `src/components/submission-application-form.tsx` |
| Public feed (announcements only) | `src/routes/index.tsx` → section `#submissions` |
| Admin: form, announcement list, submissions inbox | `src/routes/_authenticated/gestion.admin.tsx` → tab `events` (labelled **Submissions**) |
| Admin: questions editor, submissions review, check-in | `src/components/admin-submissions.tsx` |
| Server functions | `src/lib/admin-api.ts` → `listPosts` / `savePost` / `deletePost` |

### One announcement, one campaign, one place

There is no standalone campaign editor. The announcement form *is* the
application form: `savePost` receives the post **and** its campaign and writes
both, mirroring the post title into `campaigns.title` and the subtitle into
`campaigns.description` so the two can never drift. `CAMPAIGN_KIND_FOR_SUBMISSION`
derives `campaigns.kind`, and re-attaching an existing campaign reuses it rather
than creating a second one.

An announcement with no `campaign_id` shows an explicit "attach an existing
registration" picker in the admin form. This matters for rows created before
`0017`: **saving one without attaching a campaign creates a new one and orphans
the students who already applied.** The picker lists only campaigns whose kind
matches the draft's `submission_type`, with their live submission counts.

Each announcement card in the admin list expands into a submissions inbox
(`CampaignSubmissions`) for reviewing documents, accepting (which adds a member
for `membership`, and only confirms for `event`), removing, checking in, and
deleting permanently.

**Remove vs Delete.** `removeRegistration` is the safe path: it only sets
`status = 'removed'`, so the record and its uploads survive for auditing.
`deleteRegistration` is destructive — it drops the row *and* the objects in the
`identity-documents` bucket, and never touches the member row an accepted
submission created. Deleting an application must not silently un-enrol someone.
`acceptRegistration` refuses when the address is already a member, so the same
person cannot be enrolled twice from two campaigns.

`registration_campaigns` and `registrations` are kept as storage. They were
folded into the Submissions UI, not into the posts table — submissions are a
different shape from announcements and merging them would only lose the
campaign's open/closed state and custom questions.

**Permission keys:** `events` and `registrations` are now equivalent.
`SUBMISSION_SECTIONS` in `src/lib/admin-admins-api.ts` is the single definition,
`requireAnySection` accepts either, `setAdminSectionAllowed` writes both in
lockstep, and the Admins panel renders one "Submissions" switch. `registrations`
stays in `ADMIN_SECTIONS` so pre-merge grants keep working.

**Operational consequence:** a campaign is only reachable if some published
announcement links to it. Opening a campaign without publishing an announcement
for it leaves it invisible to students.

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
| `listAdminRequests` / `decideAdminRequest` / `deleteAdminRequest` | Owner (session) | The in-console equivalents: the Admins tab shows pending applications with Approve / Reject / Delete. Approving grants the role immediately instead of waiting for the emailed link |

### Token flow

Email links: `{origin}/gestion?token=<signed>`  
Token payload: `requestId:accept|cancel:expiresAtMs` signed with HMAC-SHA256  
Single-use enforced by DB status check; expires after 7 days.

### /gestion page modes

- **signin** (default): owner + approved admins sign in.
- **request** (toggled via "Apply for a club role"): collects first/last name, department, email, phone. Calls `submitAdminRequestAction`. Shows persistent confirmation card on success.
- **owner-setup**: owner-only account creation (signs up only if email matches `OWNER_EMAIL`, else steers to request form).

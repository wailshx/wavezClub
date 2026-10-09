# AGENTS.md

## Setup

- Repo uses `bun.lock`. Don't commit a generated `package-lock.json`.
- Dev server: `npm run dev`. Route files regenerate `src/routeTree.gen.ts` automatically.

## Database migrations

**Source of truth:** `drizzle/migrations/` (journal: `drizzle/migrations/meta/_journal.json`).

**Supabase CLI mirror:** the same SQL files are copied to `supabase/migrations/` so `supabase db push` / diff tooling can target the correct project (`supabase/config.toml` → `pnqdtozfqzvybewuabwc`, matching `.env`).

Until the Supabase CLI is linked to this project (`supabase link --project-ref pnqdtozfqzvybewuabwc`), apply new migrations **manually** via the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/pnqdtozfqzvybewuabwc/sql/new) — paste each file in journal order (`0000` … `0025`). After editing a migration in `drizzle/migrations/`, re-copy it to `supabase/migrations/` before applying.

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
| `0019_remap_faculty_fields.sql` | Remaps the pre-faculty `department`/`speciality` strings onto the current `DEPARTMENTS`/`SPECIALITIES` lists in `src/lib/club.ts`. Needed because those are plain `text` with no CHECK constraint: a `<select>` whose stored value is not among its options submits the first option, so editing a member would have silently rewritten their department. Trailing `SELECT`s report anything left outside the lists instead of guessing |
| `0020_close_members_public_insert.sql` | Drops `"anyone can apply"` on `members` (from `0000`, for the deleted public join form) and replaces it with an admin-only INSERT policy. **Dropping it alone would break `acceptRegistration`** — server functions use the caller's JWT with the publishable key, not the service-role key, so RLS *is* enforced on that insert and the loose policy was the only thing allowing it. Also revokes anon `INSERT` on the table. The trailing `SELECT` lists the surviving policies |
| `0017_post_campaign_link.sql` | Adds `posts.campaign_id` → `registration_campaigns(id) ON DELETE SET NULL` + index. The announcement *is* the registration entry point, so each one points at the single campaign it announces |
| `0022_expand_announcement_types.sql` | Grows `posts.submission_type` from `('openday','event')` to the four announcement types by dropping the unnamed `0016` CHECK (found by definition text, skipped if a CHECK already allows `'announcement'`) and adding `posts_submission_type_check`; adds nullable `posts.opens_at` for the `soon` teaser's date; backfills campaign-less `openday`/`event` rows to `announcement`. **Run before deploying the build** — the admin form writes `opens_at`, which does not exist until step 2 |
| `0023_restore_public_function_grants.sql` | Re-grants `EXECUTE` on the RPCs the app actually calls: `list_open_campaigns()` and `is_registration_open(uuid)` to **anon + authenticated** (the public card and the RLS policy behind every anonymous submit), `has_role` and `update_own_profile` to authenticated, `get_dashboard_stats` to service_role. Probed after `0022`: every one of them answered `42501 permission denied for function` under the publishable key, which means every public card showed the closed state and no visitor could submit. The grants were already declared in `0006`/`0007`/`0008`/`0014`/`0021` — something revoked them afterwards; this puts them back and ends with a `proacl`/`has_function_privilege` table to eyeball |
| `0021_grant_has_role_execute_to_authenticated.sql` | Grants `EXECUTE` on `has_role(uuid, app_role)` to `authenticated`. The RPC runs as the caller (publishable key + user's JWT) behind `getAdminStatus`, and Postgres only lets the owner execute a function by default, so without it every admin status check failed with `42501` |
| `0024_convert_flagged_functions_to_invoker.sql` | Clears the six `*_security_definer_function_executable` Security Advisor WARNs by converting the four flagged functions to `SECURITY INVOKER`, with RLS/grant support instead of bypass: a `USING (is_open = true)` SELECT policy on `registration_campaigns` for anon + authenticated (the counterpart to the open-campaign RPCs now running as the caller), and for `update_own_profile` an own-row UPDATE policy plus `GRANT UPDATE (display_name, avatar_url)` — column-level, so `role`/`disabled_at`/`user_id` stay untouchable now that the DEFINER wrapper is gone. `get_dashboard_stats` stays DEFINER on purpose (service_role only, outside the Advisor's scope). Only behaviour change: `has_role` about someone else's `user_id` now answers false. Re-running it is safe |
| `0025_lock_user_roles_table_grants.sql` | Closes what `0024` opened. `information_schema.column_privileges` expands table-level grants across columns, and `0024`'s verification output showed that means anon **and** authenticated held table-level `INSERT/UPDATE/SELECT/REFERENCES` on `user_roles` (Supabase default privileges on new tables — `0000` only ever granted `SELECT`; the rest came along for the ride, with RLS and no write policy as the only gate). `0024`'s own-row UPDATE policy plus that table-level UPDATE let an officer `PATCH` their own row: clear `disabled_at` after a revocation, or overwrite `admin_role`. Grants are additive, so the column-level `GRANT UPDATE (display_name, avatar_url)` narrowed nothing. This revokes `ALL` from anon/authenticated and re-states exactly what is needed (`SELECT` for authenticated, the two profile columns) — every real writer already goes through `supabaseAdmin`. Ends with four verification queries; if query 2 shows leftover DML on anon/authenticated, the grant was column-level instead and needs a per-column `REVOKE` |
| `0026_add_team_member_bio.sql` | Adds nullable `team_members.bio` (max 600 in the admin form, the muted-grey public paragraph). The migration deliberately only *lists* over-80 `role_title` rows instead of moving them — splitting "what belongs in a title vs a bio" is a human call, and the admin form blocks saving while the title is over 80 chars. `saveTeamMember` validates both lengths server-side; the public card clamps the bio to 3 lines with a "Read more" dialog |

### Announcements = submissions only

`posts` is no longer a news feed. The `event` and `news` kinds are gone from the
database, the public site and the admin console. Every row is an announcement
(`post_kind` = `'registration'`), and `submission_type` says what kind —
migration `0022` grew it from two values to four, so an announcement can move
through a lifecycle instead of being born a submission:

| `submission_type` | What the student sees | Campaign |
|---|---|---|
| `openday` | Live membership wizard — 3 steps: profile, school certificate + ID card upload, custom questions | `kind = 'membership'` |
| `event` | Live event form — single step, details only, no documents | `kind = 'event'` |
| `announcement` | Information only: eyebrow, title, body — no CTA, no form | none |
| `soon` | Teaser: a calm "Registration opening soon" plus the optional `posts.opens_at` date | none |

Only the first two are submissions. `CAMPAIGN_KIND_FOR_SUBMISSION` maps all four
to a `CampaignKind` or `null`, and `null` is what `savePost` treats as "must not
create a campaign" — for those two types a linked campaign is kept but **closed**
(and its title/description mirrored), never deleted, so its submissions survive
a round trip back to a submission type. `isOpenSubmissionType()` is the runtime
test used by the card, the feed and the admin form.

Feed order is `sortAnnouncements`: the open-submission band first, then `soon`,
then plain announcements — pinned first, newest first inside each band.

Closing rather than deleting also keeps the dashboard honest: `open_campaigns`
counts `registration_campaigns WHERE is_open`, so it drops to zero on its own
when nothing takes applications. The homepage hero and the footer use that same
open-campaign list to degrade from "Apply now" to "See announcements".

The application form lives **inside the card** — there is no separate
registration page anywhere, public or admin.

There is no shared campaign list on the homepage any more — the `#join` section
and every `hash="join"` link are gone. For the two submission types, the
announcement-type ↔ campaign-kind pair is re-validated by `savePost` server-side,
because the admin picker is filtered client-side and a stale tab can still
submit a mismatch — the save is refused and the form offers an "attach a
matching registration" picker (or "Remove link") instead.

The link is **nullable on purpose**: an announcement can be written before its
campaign exists. The public card resolves `campaign_id` against
`list_open_campaigns`, and renders a non-clickable "Registration opening soon"
state when the link is missing *or* the campaign is closed — never a dead link
into "This registration has closed".

| Piece | Path |
|---|---|
| Domain vocabulary (types, labels, CTA copy, kind mapping) | `src/lib/announcements.ts` |
| Public card (Submit button + form disclosure live here) | `src/components/submission-announcement-card.tsx` |
| Both student forms (extracted from the deleted `/register` route) | `src/components/submission-application-form.tsx` |
| Public feed (announcements only) | `src/routes/index.tsx` → section `#submissions` |
| Admin: announcement form + list (each card links to its submissions) | `src/routes/_authenticated/gestion.admin.tsx` → tab `events` (labelled **Submissions**) |
| Admin: the submissions review page, one per campaign | `src/routes/_authenticated/gestion.admin_.submissions.$campaignId.tsx` → `/gestion/admin/submissions/$campaignId` |
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

### The submissions page is its own route

`/gestion/admin/submissions/$campaignId` is **not** nested under the console. The
file is named `gestion.admin_.submissions.$campaignId.tsx` — the trailing
underscore on the `admin_` segment is TanStack Router's opt-out, so the page owns
its whole layout instead of needing an `<Outlet>` inside an already 4,000-line
console. Its file-based id is `/_authenticated/gestion/admin_/submissions/$campaignId`;
the URL is `/gestion/admin/submissions/$campaignId`.

It reuses the `admin-campaigns` query and the `CampaignSubmissions` component, so
submission counts cannot disagree with the announcement list. `inline={false}`
drops the border the console layout needed. The server function enforces the
Submissions permission, so reaching the URL is not the gate.

The console route gained `validateSearch` for an optional `?tab=`, so the page's
"Announcements" breadcrumb lands back on the Submissions tab. It returns `{}`
rather than `{ tab: undefined }` on purpose — that keeps the parameter optional
and every existing `<Link to="/gestion/admin">` compiling.

The table's whole row is the click target for the detail view, with a real
`<button>` in the Student cell for keyboard and screen readers. Both it and the
actions cell call `stopPropagation`, so one click is one toggle and acting on a
student does not also expand them.

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
| `CLUB_REPLY_TO` | Optional. Where replies to club mail land, when `From` is a no-reply address on a verified domain. Defaults to `CLUB_EMAIL`. Not set, and not needed, until a Resend domain is verified |

### Must be set in Lovable production env (NOT committed)

| Variable | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Used by `client.server.ts` (bypasses RLS for admin operations) |
| `ADMIN_REQUEST_SIGNING_SECRET` | HMAC signing key for accept/cancel tokens (falls back to insecure dev default locally) |
| `RESEND_API_KEY` | Resend API key for applicant-facing mail (rejection, member emails) — **secret; do not commit** |
| `RESEND_FROM` | Optional sender override (e.g. `Wavez Club <no-reply@wavez.club>`). Defaults to the temporary `onboarding@resend.dev` until a verified domain is configured |
| `TELEGRAM_BOT_TOKEN` | Bot token for the owner's new-admin-request alert — **secret; do not commit** |
| `TELEGRAM_CHAT_ID` | Chat that receives the owner alert |

`TELEGRAM_BOT_TOKEN` is a full credential: anyone holding it can send messages
as the bot and read its updates. Keep it out of `.env` (that file is tracked).
Use `.env.local`, which `.gitignore` excludes. In Vercel, mark both variables
**sensitive** — that makes them write-only, so they are readable by the runtime
but not pullable with `vercel env pull`.

### The owner alert is Telegram, not email

When someone applies for a club role, `submitAdminRequestAction` pings the owner
through `sendTelegramMessage` (`src/lib/telegram.server.ts`) instead of Resend.
An officer application is time-sensitive in a way club mail is not, and the
owner watches the club chat rather than an inbox.

**Everything applicant-facing still goes out over email, deliberately.** The
accept/cancel stub and the rejection notice in `decideAdminRequestAction` are
unchanged Resend calls — a rejected applicant must be able to check their mail
for the outcome.

The message carries the applicant's name, requested role, email, phone and the
signed `/gestion/review/$token` link. Every interpolated field is HTML-escaped:
Telegram's `parse_mode: "HTML"` rejects an entire message containing a bare `<`,
so an unescaped applicant name would turn every alert into a 400.

**The review link is the only approval path.** If the alert fails, the request
sits in `pending` with nothing able to approve it, so `sendTelegramMessage` never
throws (matching `sendResendEmail`) and the handler logs loudly and returns
`ownerNotified: false`. Note that the /gestion form currently ignores that flag —
a failed alert is visible only in server logs.

## Invited officers set their own password

Supabase does not render a set-password screen. An invite is a link to
`/auth/v1/verify` that bounces to a `redirectTo` you choose, carrying a live
session in the URL hash on the implicit flow this client uses. So the app has
to supply that page: `src/routes/gestion/set-password.tsx` reads the hash
(which GoTrue strips as soon as it exchanges it, so the raw value is captured
during first render), waits for the session, and calls
`supabase.auth.updateUser({ password })`. On success the officer is already
signed in and goes straight to the console.

`redirectTo` is set in **two** places, and they must agree:

| Call site | Path |
|---|---|
| `decideAdminRequestAction` (emailed review link) | `src/lib/admin-gestion-api.ts` |
| in-console Approve (Admins tab) | `src/lib/admin-admins-api.ts` |

Both use the request's own host, so local invites point at localhost.

**The dashboard allowlist is load-bearing and fails silently.** GoTrue only
honours `redirectTo` when the origin+path matches an entry under
Authentication → URL Configuration; otherwise it drops the redirect and falls
back to the Site URL, and the recipient lands on the homepage with an
`#error=access_denied` hash and no password screen. There is no error on the
invite call itself. Required entries:

- Site URL: `https://wavez-club-p2b4.vercel.app`
- Redirect URLs: `https://wavez-club-p2b4.vercel.app/**` and
  `https://wavezclub-wailshs-projects.vercel.app/**` (the auto-generated team
  domain) plus `http://localhost:8081/**` for local testing.

**Verified 2026-10-02: this list was wrong.** The probe showed the Site URL was
still `https://wavezclub-wailshs-projects.vercel.app` and that
`https://wavez-club-p2b4.vercel.app/**` was *not* on the allowlist — that origin was
silently replaced by the Site URL. Any invite or set-password link built on the
brand domain therefore spent its single-use token and dropped the officer on the
team-domain homepage instead of the password page. Re-probe after any dashboard
change; do not trust this list.

`redirectTo` must therefore never be built from the request's `Host` header:
the review link is opened from a phone over Telegram, so the host depends on
which URL was tapped. `CANONICAL_ORIGIN` in `src/lib/app-origin.server.ts` is
the single source for both call sites, and localhost is honoured only for local
dev.

To check the allowlist without dashboard access, probe it — GoTrue redirects
even a bogus token, so a rejected `redirect_to` is observable in the
`Location` header:

```sh
curl -s -o /dev/null -D - "$SUPABASE_URL/auth/v1/verify?token=probe&type=invite&redirect_to=https://wavez-club-p2b4.vercel.app/gestion" | grep -i location
```

A rejected value comes back as the bare Site URL.

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
| `submitAdminRequestAction` | Public (anon client) | Insert pending request + Telegram alert with the signed review link |
| `ensureOwnerAdmin` | Auth middleware | On every `_authenticated` entry, if signed-in email matches `OWNER_EMAIL`, insert the `president` role if missing |
| `ensureApprovedRequestRole` | Auth middleware | On every `_authenticated` entry, if the caller has no officer role but an **approved** request matches their verified email, grant that request's `department`. Repairs officers approved before the grant was written to the wrong table |
| `decideAdminRequestAction` | Token-authenticated | Accept: resolve the auth user, grant `user_roles`, then mark approved. Cancel: mark rejected + rejection email |
| `listAdminRequests` / `decideAdminRequest` / `deleteAdminRequest` | Owner (session) | The in-console equivalents: the Admins tab shows pending applications with Approve / Reject / Delete. Approving grants the role immediately instead of waiting for the emailed link |

### The officer role must land in `user_roles`

Authorization is `has_role(auth.uid(), 'admin')`, which reads **only**
`public.user_roles`. `admin_requests` is the application record; it has no
`user_id`, `role` or `admin_role` column, and there is no trigger syncing the
two. A grant written anywhere else is invisible.

Both accept paths therefore go through `ensureAdminRoleGrant`
(`src/lib/admin-role-grant.ts`) — the emailed review link
(`decideAdminRequestAction`) and the console's Admins tab
(`decideAdminRequest`). They previously disagreed: the console wrote
`user_roles`, while the review link upserted `{user_id, role, admin_role}` into
`admin_requests`, a write PostgREST rejects with `PGRST204` ("Could not find the
'admin_role' column"). That error was never checked, so accept reported success
and the officer could set a password and sign in — then got "Not a club officer"
on every page. The helper grants **before** the request is marked approved, so a
failure leaves it pending and retryable rather than approved-but-roleless.

Two details the helper exists to keep in one place:

- It filters on `role = 'admin'`, not just `user_id`. A person can also hold a
  non-admin `user_roles` row, and matching on `user_id` alone would treat them
  as already granted and skip the insert.
- Revocation is **soft** (`user_roles.disabled_at`); nothing deletes the row. An
  existence check is therefore what stops a re-grant from undoing a revocation.

`ensureApprovedRequestRole` is the self-heal for accounts broken before the fix:
`admin_requests` has no `user_id`, so it links by email, which is safe because
the email comes from the caller's own verified session — it can only ever
re-grant a role the club already approved.

### Token flow

Email links: `{origin}/gestion?token=<signed>`  
Token payload: `requestId:accept|cancel:expiresAtMs` signed with HMAC-SHA256  
Single-use enforced by DB status check; expires after 7 days.

### /gestion page modes

- **signin** (default): owner + approved admins sign in.
- **request** (toggled via "Apply for a club role"): collects first/last name, department, email, phone. Calls `submitAdminRequestAction`. Shows persistent confirmation card on success.
- **owner-setup**: owner-only account creation (signs up only if email matches `OWNER_EMAIL`, else steers to request form).

-- 0016: Announcements become submission-only.
--
-- ALREADY APPLIED to production (`pnqdtozfqzvybewuabwc`) on 2026-09-28. Every
-- step below is guarded so a re-run is a no-op rather than destructive — do not
-- paste it into a database that already has submission announcements, and do not
-- "fix" the guards back into bare ALTERs.
--
-- The "event" and "news" announcement types are retired everywhere (public feed
-- + admin console). What remains is a single kind — `registration` — used to
-- announce an open-day or club-event submission that students can apply to.
--
-- Every row therefore gains:
--   * submission_type — which submission the card announces ('openday' | 'event');
--   * subtitle        — a one-line hook that sits under the title;
--   * is_pinned       — floats the announcement above the rest of the feed.
--
-- The public feed renders these through `SubmissionAnnouncementCard`, whose CTA
-- always points at `#join` (the open-campaign list), so there is deliberately no
-- foreign key to `registration_campaigns` here.

-- 1 · Retire the old event/news announcements.
--
--     Scoped to the retired kinds rather than `DELETE FROM public.posts`, so that
--     re-running this migration is a no-op instead of silently wiping every
--     submission published since. On a database that predates this migration
--     every row is event/news, so this still removes them all.
DELETE FROM public.posts WHERE kind::text <> 'registration';

-- 2 · `registration` becomes the only announcement kind. Postgres cannot remove
--     a value from an enum in place, so rebuild the type. The covering index goes
--     first because it references the column we are about to drop.
DROP INDEX IF EXISTS public.posts_kind_published_idx;
ALTER TABLE public.posts DROP COLUMN IF EXISTS kind;
DROP TYPE IF EXISTS public.post_kind;

--     Postgres has no `CREATE TYPE IF NOT EXISTS`, so guard it by hand. Without
--     this a re-run dies here and the remaining steps are never applied.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_kind') THEN
    CREATE TYPE public.post_kind AS ENUM ('registration');
  END IF;
END
$$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kind public.post_kind NOT NULL DEFAULT 'registration';

-- 3 · Which submission this announcement opens (drives the card's type pill).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'openday'
  CHECK (submission_type IN ('openday', 'event'));

-- 4 · Short hook under the title. A `text` column (not null, empty default) so
--     older tooling and the RLS policies keep working unchanged.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '';

-- 5 · Persisted pin: pinned rows sort above everything else in the feed.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 6 · Feed index matching the public read: published → pinned → newest.
CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON public.posts (published, is_pinned DESC, created_at DESC);

-- 7 · Refresh the dashboard RPC.
--
--     The `events_by_month` CTE filtered on `p.kind = 'event'`, which can no
--     longer match anything now that `registration` is the only kind — the chart
--     would have gone permanently flat. It now buckets every announcement.
--
--     The JSON key stays `events` (and the `p_events_allowed` flag with it) so the
--     existing `admin_permissions` rows, the `AdminSection` union and the RPC
--     signature all keep working; only the human-facing labels changed.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_members_allowed boolean DEFAULT false,
  p_events_allowed boolean DEFAULT false,
  p_registrations_allowed boolean DEFAULT false,
  p_include_pending_requests boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - interval '5 months',
      date_trunc('month', NOW()),
      interval '1 month'
    ) AS m
  ),
  member_growth AS (
    SELECT
      mm.m,
      mm.cnt,
      SUM(mm.cnt) OVER (ORDER BY mm.m)::int AS cumulative,
      to_char(mm.m, 'Mon YY') AS month
    FROM (
      SELECT months.m, COUNT(m.id)::int AS cnt
      FROM months
      LEFT JOIN members m ON date_trunc('month', m.created_at) = months.m
      GROUP BY months.m
    ) mm
  ),
  announcements_by_month AS (
    SELECT
      months.m,
      to_char(months.m, 'Mon YY') AS month,
      COUNT(p.id)::int AS count
    FROM months
    LEFT JOIN posts p
      ON date_trunc('month', COALESCE(p.event_date, p.created_at)) = months.m
    GROUP BY months.m
  ),
  campaign_funnel AS (
    SELECT
      c.id, c.title, c.kind, c.created_at, c.display_order,
      COUNT(r.id)::int                                AS submitted,
      COUNT(r.id) FILTER (WHERE r.checked_in)::int    AS checked_in,
      COUNT(r.id) FILTER (WHERE r.status = 'pending') AS pending,
      COUNT(r.id) FILTER (WHERE r.status = 'accepted')::int AS accepted,
      COUNT(r.id) FILTER (WHERE r.status = 'removed')::int  AS removed
    FROM registration_campaigns c
    LEFT JOIN registrations r ON r.campaign_id = c.id
    WHERE c.is_open = true
    GROUP BY c.id
    ORDER BY c.display_order ASC, c.created_at ASC
    LIMIT 6
  ),
  decision_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
      COUNT(*) FILTER (WHERE status = 'removed') AS removed
    FROM registrations
  ),
  registration_submissions_by_month AS (
    SELECT
      months.m,
      to_char(months.m, 'Mon YY') AS month,
      COUNT(r.id)::int AS submitted
    FROM months
    LEFT JOIN registrations r ON date_trunc('month', r.created_at) = months.m
    GROUP BY months.m
  ),
  admin_requests_by_month AS (
    SELECT
      months.m,
      to_char(months.m, 'Mon YY') AS month,
      COUNT(r.id)::int AS count
    FROM months
    LEFT JOIN admin_requests r ON date_trunc('month', r.created_at) = months.m
    GROUP BY months.m
  )
  SELECT jsonb_build_object(
    'members',
      CASE WHEN p_members_allowed THEN jsonb_build_object(
        'total', (SELECT COUNT(*)::int FROM members),
        'blocked', (SELECT COUNT(*)::int FROM members WHERE blocked_until IS NOT NULL AND blocked_until > NOW()),
        'created_this_month', (SELECT COUNT(*)::int FROM members WHERE created_at >= date_trunc('month', NOW())),
        'created_last_month', (SELECT COUNT(*)::int FROM members
          WHERE created_at >= date_trunc('month', NOW()) - interval '1 month'
            AND created_at < date_trunc('month', NOW())),
        'by_month', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('month', g.month, 'cumulative', g.cumulative) ORDER BY g.m)
          FROM member_growth g), '[]'::jsonb),
        'by_level', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('level', lv.level, 'value', lv.value) ORDER BY lv.level)
          FROM (SELECT level AS level, COUNT(*)::int AS value FROM members GROUP BY level) lv), '[]'::jsonb),
        'by_department', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('department', d.department, 'value', d.value)
            ORDER BY d.value DESC, d.department ASC
          )
          FROM (SELECT department AS department, COUNT(*)::int AS value FROM members GROUP BY department) d), '[]'::jsonb)
      ) ELSE jsonb_build_object('total', 0, 'blocked', 0, 'created_this_month', 0, 'created_last_month', 0,
        'by_month', '[]'::jsonb, 'by_level', '[]'::jsonb, 'by_department', '[]'::jsonb) END,
    'adminRequests',
      jsonb_build_object(
        'pending_count', CASE WHEN p_include_pending_requests THEN
          (SELECT COUNT(*)::int FROM admin_requests WHERE status = 'pending') ELSE 0 END,
        'pending', CASE WHEN p_include_pending_requests THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'name', r.first_name || ' ' || r.last_name,
            'email', r.email,
            'role', r.department::text,
            'created_at', r.created_at
          ) ORDER BY r.created_at ASC)
          FROM (
            SELECT id, first_name, last_name, email, department, created_at
            FROM admin_requests
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 20
          ) r), '[]'::jsonb) ELSE '[]'::jsonb END,
        'by_month', CASE WHEN p_include_pending_requests THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object('month', rb.month, 'count', rb.count) ORDER BY rb.m)
          FROM admin_requests_by_month rb), '[]'::jsonb) ELSE '[]'::jsonb END
      ),
    'registrations',
      CASE WHEN p_registrations_allowed THEN jsonb_build_object(
        'open_campaigns', (SELECT COUNT(*)::int FROM registration_campaigns WHERE is_open = true),
        'pending_total', (SELECT COUNT(*)::int FROM registrations WHERE status = 'pending'),
        'acceptance_rate', (
          SELECT
            CASE WHEN dt.accepted + dt.removed = 0 THEN NULL
                 ELSE ROUND(dt.accepted::numeric / (dt.accepted + dt.removed) * 100, 1) END
          FROM decision_totals dt),
        'campaigns', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', cf.id, 'title', cf.title, 'kind', cf.kind, 'display_order', cf.display_order,
            'submitted', cf.submitted, 'checked_in', cf.checked_in,
            'pending', cf.pending, 'accepted', cf.accepted, 'removed', cf.removed
          ) ORDER BY cf.display_order ASC, cf.created_at ASC)
          FROM campaign_funnel cf), '[]'::jsonb),
        'by_month', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('month', rb.month, 'submitted', rb.submitted) ORDER BY rb.m)
          FROM registration_submissions_by_month rb), '[]'::jsonb)
      ) ELSE jsonb_build_object('open_campaigns', 0, 'pending_total', 0, 'acceptance_rate', NULL,
        'campaigns', '[]'::jsonb, 'by_month', '[]'::jsonb) END,
    'events',
      CASE WHEN p_events_allowed THEN jsonb_build_object(
        'by_month', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('month', ab.month, 'count', ab.count) ORDER BY ab.m)
          FROM announcements_by_month ab), '[]'::jsonb),
        'published', (SELECT COUNT(*)::int FROM posts WHERE published = true),
        'drafts', (SELECT COUNT(*)::int FROM posts WHERE published = false)
      ) ELSE jsonb_build_object('by_month', '[]'::jsonb, 'published', 0, 'drafts', 0) END,
    'admins',
      jsonb_build_object(
        'active_total', (SELECT COUNT(*)::int FROM user_roles WHERE role = 'admin' AND disabled_at IS NULL),
        'total', (SELECT COUNT(*)::int FROM user_roles WHERE role = 'admin'),
        'by_role', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('role', ar.role, 'value', ar.value) ORDER BY ar.value DESC, ar.role ASC)
          FROM (
            SELECT COALESCE(admin_role::text, 'General') AS role, COUNT(*)::int AS value
            FROM user_roles
            WHERE role = 'admin' AND disabled_at IS NULL
            GROUP BY admin_role
          ) ar), '[]'::jsonb)
      )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(boolean, boolean, boolean, boolean) TO service_role;

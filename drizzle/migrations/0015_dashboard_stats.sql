-- 0015: Single SQL-side aggregation RPC backing the redesigned admin Dashboard.
--
-- One call returns every chart/count the Dashboard needs, so the UI never has to
-- fan out to row-level reads and reduce them client-side.
--
-- Access control is enforced *inside* the RPC:
--   - the caller passes which sections the signed-in admin may actually see, so a
--     restricted admin never receives member / event / registration aggregates;
--   - pending admin-request data (+ its count) is returned only for the owner;
--   - the function is granted to service_role ONLY (not `authenticated`/`anon`), so
--     PostgREST clients can't bypass the app's admin gate and call it directly.

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
  events_by_month AS (
    SELECT
      months.m,
      to_char(months.m, 'Mon YY') AS month,
      COUNT(p.id)::int AS count
    FROM months
    LEFT JOIN posts p
      ON p.kind = 'event'
     AND date_trunc('month', COALESCE(p.event_date, p.created_at)) = months.m
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
          ) r), '[]'::jsonb) ELSE '[]'::jsonb END
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
          FROM campaign_funnel cf), '[]'::jsonb)
      ) ELSE jsonb_build_object('open_campaigns', 0, 'pending_total', 0, 'acceptance_rate', NULL,
        'campaigns', '[]'::jsonb) END,
    'events',
      CASE WHEN p_events_allowed THEN jsonb_build_object(
        'by_month', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('month', eb.month, 'count', eb.count) ORDER BY eb.m)
          FROM events_by_month eb), '[]'::jsonb),
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
-- Deliberately NOT granted to `authenticated`/`anon`: the app's server function is
-- the only caller, so PostgREST clients cannot invoke this outside the admin gate.
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(boolean, boolean, boolean, boolean) TO service_role;

-- Indexes supporting the monthly buckets / funnel queries.
CREATE INDEX IF NOT EXISTS members_created_at_idx ON public.members (created_at);
CREATE INDEX IF NOT EXISTS registrations_campaign_status_idx ON public.registrations (campaign_id, status);
CREATE INDEX IF NOT EXISTS admin_requests_status_idx ON public.admin_requests (status);
CREATE INDEX IF NOT EXISTS posts_kind_published_idx ON public.posts (kind, published);
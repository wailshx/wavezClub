-- 0021: grant EXECUTE on has_role RPC to authenticated users
-- has_role is SECURITY DEFINER (bypasses RLS) and is used by both
-- RLS policies and the app's getAdminStatus RPC. The latter runs as
-- the authenticated user (publishable key + user's JWT), so authenticated
-- must be able to execute it. This is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'has_role'
      AND grantee = 'authenticated'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
  ELSE
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
  END IF;
END $$;

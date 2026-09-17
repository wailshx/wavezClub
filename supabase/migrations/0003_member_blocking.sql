-- Member blocking: nullable TIMESTAMPTZ. NULL = not blocked; future date = blocked until then.
ALTER TABLE public.members ADD COLUMN blocked_until timestamptz;

-- Existing table-level grants and the "admins update members" RLS policy cover
-- UPDATE on this new column, so no additional grants or policies are required.

-- Revoke direct column access to sensitive fields from ordinary members.
-- The has_role SECURITY DEFINER function and get_member_phone RPC keep admin/owner access working.
REVOKE SELECT (phone, fcm_token) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, fcm_token) ON public.profiles FROM anon;

-- Ensure service role & the row owner path still work (service_role bypasses RLS anyway).
GRANT SELECT (phone, fcm_token) ON public.profiles TO service_role;

-- Remove profiles from the realtime publication so token/phone changes don't broadcast.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles';
  END IF;
END $$;

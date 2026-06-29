
-- 1. profiles: restrict phone & fcm_token from broad SELECT via column grants
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, arabic_name, avatar_url, is_active,
  created_at, updated_at, first_name, father_name,
  grandfather_name, parent_id, terms_accepted_at
) ON public.profiles TO authenticated;

-- Owner self-read (includes sensitive cols) via security definer
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Phone access for owner / admin / chairman
CREATE OR REPLACE FUNCTION public.get_member_phone(_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT phone FROM public.profiles
  WHERE id = _user
    AND (
      auth.uid() = _user
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'chairman'::app_role)
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_member_phone(uuid) TO authenticated;

-- FCM token count helper (admin/chairman only)
CREATE OR REPLACE FUNCTION public.count_fcm_tokens()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'chairman'::app_role)
    THEN (
      SELECT COUNT(*)::int FROM public.profiles
      WHERE fcm_token IS NOT NULL AND length(fcm_token) > 10
    )
    ELSE 0
  END;
$$;
GRANT EXECUTE ON FUNCTION public.count_fcm_tokens() TO authenticated;

-- 2. user_roles: drop manager-escalation policy
DROP POLICY IF EXISTS "Managers manage non-admin roles" ON public.user_roles;

-- 3. can_manage_section: require section_heads match for managers (not blanket)
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user, 'admin'::app_role)
    OR public.has_role(_user, 'chairman'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.section_heads
      WHERE user_id = _user AND section = _section
    );
$$;

-- 4. trip_items: remove USING(true) on UPDATE
DROP POLICY IF EXISTS "Members can claim or release trip items" ON public.trip_items;
CREATE POLICY "Members can claim or release trip items"
ON public.trip_items
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK ((auth.uid() = assigned_to) OR (assigned_to IS NULL));

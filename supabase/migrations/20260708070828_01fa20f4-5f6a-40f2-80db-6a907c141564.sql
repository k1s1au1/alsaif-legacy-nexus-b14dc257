REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at) ON public.profiles TO authenticated;
-- Owners still get phone/fcm_token via get_my_profile() and get_member_phone() SECURITY DEFINER functions.
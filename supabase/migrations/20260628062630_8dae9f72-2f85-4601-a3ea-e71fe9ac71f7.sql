CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user
      AND role IN (
        'admin'::app_role,
        'manager'::app_role,
        'chairman'::app_role,
        CASE _section
          WHEN 'meetings' THEN 'head_meetings'::app_role
          WHEN 'events' THEN 'head_events'::app_role
          WHEN 'trips' THEN 'head_trips'::app_role
          WHEN 'finance' THEN 'head_finance'::app_role
          WHEN 'heritage' THEN 'head_heritage'::app_role
          ELSE 'admin'::app_role
        END
      )
  )
$function$;
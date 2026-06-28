
-- 1) New section_heads table
CREATE TABLE public.section_heads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('meetings','events','trips','finance','heritage','majlis')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);

GRANT SELECT ON public.section_heads TO authenticated;
GRANT ALL ON public.section_heads TO service_role;

ALTER TABLE public.section_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view section heads"
  ON public.section_heads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins/chairman manage section heads"
  ON public.section_heads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- 2) Migrate existing head_* roles into section_heads
INSERT INTO public.section_heads (user_id, section)
SELECT user_id,
  CASE role::text
    WHEN 'head_meetings' THEN 'meetings'
    WHEN 'head_events' THEN 'events'
    WHEN 'head_trips' THEN 'trips'
    WHEN 'head_finance' THEN 'finance'
    WHEN 'head_heritage' THEN 'heritage'
  END
FROM public.user_roles
WHERE role::text LIKE 'head_%'
ON CONFLICT DO NOTHING;

-- 3) Remove head_* rows from user_roles (enum values remain for safety; code stops using them)
DELETE FROM public.user_roles WHERE role::text LIKE 'head_%';

-- 4) Replace can_manage_section to read from section_heads
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user
      AND role IN ('admin'::app_role, 'manager'::app_role, 'chairman'::app_role)
  ) OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = _user AND section = _section
  );
$$;

-- 5) Security fix: drop overlapping permissive UPDATE policy on conversation_participants
DROP POLICY IF EXISTS "Self updates participant row, admin updates roles" ON public.conversation_participants;

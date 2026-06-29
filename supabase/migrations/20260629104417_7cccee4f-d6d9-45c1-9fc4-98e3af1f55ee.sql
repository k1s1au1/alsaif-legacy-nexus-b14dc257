CREATE TABLE public.trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_items TO authenticated;
GRANT ALL ON public.trip_items TO service_role;

ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view trip items"
ON public.trip_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Trip managers can manage trip items"
ON public.trip_items FOR ALL
TO authenticated
USING (public.can_manage_section(auth.uid(), 'trips'))
WITH CHECK (public.can_manage_section(auth.uid(), 'trips'));

CREATE POLICY "Members can claim or release trip items"
ON public.trip_items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (auth.uid() = assigned_to OR assigned_to IS NULL);

CREATE TRIGGER update_trip_items_updated_at
BEFORE UPDATE ON public.trip_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing trip checklist items from majlis_posts
INSERT INTO public.trip_items (trip_id, name, assigned_to, created_by, created_at, updated_at)
SELECT
  (regexp_match(title, '^\[TRIP-ITEM:([^\]]+)\]'))[1]::uuid AS trip_id,
  trim(regexp_replace(title, '^\[TRIP-ITEM:[^\]]+\]\s*', '')) AS name,
  CASE
    WHEN body LIKE 'ASSIGNED:%'
    THEN split_part(substring(body from '^ASSIGNED:([^\n]+)'), E'\n', 1)::uuid
    ELSE NULL
  END AS assigned_to,
  author_id AS created_by,
  created_at,
  COALESCE(updated_at, created_at) AS updated_at
FROM public.majlis_posts
WHERE kind = 'discussion' AND title LIKE '[TRIP-ITEM:%]';

-- Delete migrated rows from majlis_posts
DELETE FROM public.majlis_posts
WHERE kind = 'discussion' AND title LIKE '[TRIP-ITEM:%]';

NOTIFY pgrst, 'reload schema';
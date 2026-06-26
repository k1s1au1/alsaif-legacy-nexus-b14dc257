
-- Comprehensive setup for Trip Checklists
-- This migration creates the table and sets up all necessary RLS policies.

CREATE TABLE IF NOT EXISTS public.trip_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_checklists TO authenticated;
GRANT ALL ON public.trip_checklists TO service_role;

-- Enable RLS
ALTER TABLE public.trip_checklists ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can view trip checklists" ON public.trip_checklists;
DROP POLICY IF EXISTS "Authenticated can view checklists" ON public.trip_checklists;
CREATE POLICY "Authenticated can view checklists"
  ON public.trip_checklists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Priv roles can manage all checklist items" ON public.trip_checklists;
DROP POLICY IF EXISTS "Managers can manage checklist items" ON public.trip_checklists;
CREATE POLICY "Managers can manage checklist items"
  ON public.trip_checklists FOR ALL
  TO authenticated
  USING (public.can_manage_section(auth.uid(), 'trips'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'trips'));

DROP POLICY IF EXISTS "Users can claim items" ON public.trip_checklists;
CREATE POLICY "Users can claim items"
  ON public.trip_checklists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trip_checklists_touch ON public.trip_checklists;
CREATE TRIGGER trip_checklists_touch BEFORE UPDATE ON public.trip_checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

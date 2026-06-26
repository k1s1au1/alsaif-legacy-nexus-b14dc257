
-- Create a new table with a different name to bypass potential schema cache sticking
CREATE TABLE public.trip_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT ALL ON public.trip_items TO authenticated;
GRANT ALL ON public.trip_items TO service_role;

-- Enable RLS
ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View trip items" ON public.trip_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage trip items" ON public.trip_items
  FOR ALL TO authenticated
  USING (public.can_manage_section(auth.uid(), 'trips'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'trips'));

CREATE POLICY "Claim trip items" ON public.trip_items
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER trip_items_touch BEFORE UPDATE ON public.trip_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Force Schema Refresh
NOTIFY pgrst, 'reload schema';

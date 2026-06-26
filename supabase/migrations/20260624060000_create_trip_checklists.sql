
-- Trip Checklists - "Who brings what?"
CREATE TABLE public.trip_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_checklists TO authenticated;
GRANT ALL ON public.trip_checklists TO service_role;

ALTER TABLE public.trip_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trip checklists"
  ON public.trip_checklists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Priv roles can manage all checklist items"
  ON public.trip_checklists FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  );

-- Allow anyone to "claim" an item by updating assigned_to
CREATE POLICY "Users can claim items"
  ON public.trip_checklists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trip_checklists_touch BEFORE UPDATE ON public.trip_checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

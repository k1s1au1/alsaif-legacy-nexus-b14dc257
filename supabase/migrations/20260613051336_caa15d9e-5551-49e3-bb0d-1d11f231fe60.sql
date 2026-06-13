CREATE TABLE public.trip_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.trip_attendees TO authenticated;
GRANT ALL ON public.trip_attendees TO service_role;

ALTER TABLE public.trip_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendees"
  ON public.trip_attendees FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users confirm own attendance"
  ON public.trip_attendees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own attendance"
  ON public.trip_attendees FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX trip_attendees_trip_id_idx ON public.trip_attendees(trip_id);
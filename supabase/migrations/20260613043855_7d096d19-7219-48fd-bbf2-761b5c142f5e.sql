CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  badge text,
  location text,
  start_date date,
  end_date date,
  description text,
  image_url text,
  status text NOT NULL DEFAULT 'upcoming',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view trips" ON public.trips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create trips" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators or admins can update trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creators or admins can delete trips" ON public.trips
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trips_touch_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
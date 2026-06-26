
-- Souq Alsaif - Family Business Directory
CREATE TABLE public.family_businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  whatsapp_number TEXT,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_businesses TO authenticated;
GRANT ALL ON public.family_businesses TO service_role;

ALTER TABLE public.family_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view businesses"
  ON public.family_businesses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage their businesses"
  ON public.family_businesses FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Priv roles can manage all businesses"
  ON public.family_businesses FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  );

CREATE TRIGGER family_businesses_touch BEFORE UPDATE ON public.family_businesses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

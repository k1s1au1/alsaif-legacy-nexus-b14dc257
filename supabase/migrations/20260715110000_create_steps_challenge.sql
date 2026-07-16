CREATE TABLE public.steps_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  steps INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.steps_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all steps data" ON public.steps_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own steps data" ON public.steps_data FOR ALL TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON public.steps_data TO authenticated;
GRANT ALL ON public.steps_data TO service_role;


-- Allow profiles.parent_id to point to either a profile or a tree-only member
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_parent_id_fkey;

-- Tree-only members (no auth account)
CREATE TABLE IF NOT EXISTS public.family_tree_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  father_name text,
  grandfather_name text,
  parent_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_tree_extras TO authenticated;
GRANT ALL ON public.family_tree_extras TO service_role;

ALTER TABLE public.family_tree_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All members view extras" ON public.family_tree_extras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers manage extras" ON public.family_tree_extras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER family_tree_extras_touch_updated_at
  BEFORE UPDATE ON public.family_tree_extras
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

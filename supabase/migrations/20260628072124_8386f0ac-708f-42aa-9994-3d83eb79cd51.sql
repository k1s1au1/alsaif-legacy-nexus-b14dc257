
-- ============= Security fix: majlis_posts =============
DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;

CREATE POLICY "Author or admin/manager can delete posts"
ON public.majlis_posts
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Author or admin/manager can update posts"
ON public.majlis_posts
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

-- ============= Family projects =============
DO $$ BEGIN
  CREATE TYPE public.family_project_status AS ENUM ('pending','approved','rejected','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.family_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  goal_amount numeric(12,2) NOT NULL CHECK (goal_amount > 0),
  fund_allocation numeric(12,2) NOT NULL DEFAULT 0 CHECK (fund_allocation >= 0),
  fund_transaction_id uuid REFERENCES public.fund_transactions(id) ON DELETE SET NULL,
  status public.family_project_status NOT NULL DEFAULT 'pending',
  proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_projects TO authenticated;
GRANT ALL ON public.family_projects TO service_role;

ALTER TABLE public.family_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects"
ON public.family_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can propose projects"
ON public.family_projects FOR INSERT TO authenticated
WITH CHECK (
  proposed_by = auth.uid()
  AND status = 'pending'
  AND fund_allocation = 0
);

CREATE POLICY "Proposer can delete pending or admins anytime"
ON public.family_projects FOR DELETE TO authenticated
USING (
  (proposed_by = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Chairman/admin can update projects"
ON public.family_projects FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE TRIGGER trg_family_projects_updated
BEFORE UPDATE ON public.family_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Contributions =============
CREATE TABLE IF NOT EXISTS public.family_project_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.family_projects(id) ON DELETE CASCADE,
  contributor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.family_project_contributions TO authenticated;
GRANT ALL ON public.family_project_contributions TO service_role;

ALTER TABLE public.family_project_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contributions"
ON public.family_project_contributions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can add their own contributions to approved projects"
ON public.family_project_contributions FOR INSERT TO authenticated
WITH CHECK (
  contributor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.family_projects p
    WHERE p.id = project_id AND p.status = 'approved'
  )
);

CREATE POLICY "Owner or admin can delete contribution"
ON public.family_project_contributions FOR DELETE TO authenticated
USING (
  contributor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_family_project_contrib_project
  ON public.family_project_contributions(project_id);

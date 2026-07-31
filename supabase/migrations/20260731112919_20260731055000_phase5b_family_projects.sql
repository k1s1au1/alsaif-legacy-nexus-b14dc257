/*
# Phase 5b: Finance (family projects and contributions only)

The fund_transactions and bank_transfers tables already exist in the database.
This migration creates only the two missing finance tables.

1. New Tables

### family_projects
Crowdfunded family initiatives with a funding goal, raised amount, and fund allocation.
Columns: id, title, description, goal_amount, raised_amount, fund_allocation,
status (draft/active/funded/completed/cancelled), image_url, created_by, created_at.

### family_project_contributions
Individual member contributions toward a specific family project.
Columns: id, project_id, user_id, amount, notes, transaction_id, created_at.

2. Security
- family_projects: all authenticated can read; admin/chairman/manager can write.
- family_project_contributions: all authenticated can read; members insert own rows;
  admin/chairman can update/delete.
*/

CREATE TABLE IF NOT EXISTS public.family_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  goal_amount     numeric(12,2) NOT NULL DEFAULT 0,
  raised_amount   numeric(12,2) NOT NULL DEFAULT 0,
  fund_allocation numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','funded','completed','cancelled')),
  image_url       text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.family_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_family_projects" ON public.family_projects;
CREATE POLICY "auth_select_family_projects" ON public.family_projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_family_projects" ON public.family_projects;
CREATE POLICY "manager_insert_family_projects" ON public.family_projects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_update_family_projects" ON public.family_projects;
CREATE POLICY "manager_update_family_projects" ON public.family_projects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_family_projects" ON public.family_projects;
CREATE POLICY "manager_delete_family_projects" ON public.family_projects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- family_project_contributions
CREATE TABLE IF NOT EXISTS public.family_project_contributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES public.family_projects(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL,
  notes          text,
  transaction_id uuid REFERENCES public.fund_transactions(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.family_project_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_contributions" ON public.family_project_contributions;
CREATE POLICY "auth_select_contributions" ON public.family_project_contributions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_contributions" ON public.family_project_contributions;
CREATE POLICY "own_insert_contributions" ON public.family_project_contributions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_contributions" ON public.family_project_contributions;
CREATE POLICY "admin_update_contributions" ON public.family_project_contributions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_contributions" ON public.family_project_contributions;
CREATE POLICY "admin_delete_contributions" ON public.family_project_contributions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));


-- Fix RLS for account_requests to ensure Chairman can view and manage requests
DROP POLICY IF EXISTS "Admins and managers can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can delete account requests" ON public.account_requests;

-- Ensure these don't exist under the new names if this is re-run
DROP POLICY IF EXISTS "Privileged roles can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged roles can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged roles can delete account requests" ON public.account_requests;

CREATE POLICY "Privileged roles can view account requests"
ON public.account_requests
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Privileged roles can update account requests"
ON public.account_requests
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Privileged roles can delete account requests"
ON public.account_requests
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

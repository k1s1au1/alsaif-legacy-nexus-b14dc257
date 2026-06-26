
-- Fix RLS for trip_checklists to use the standard management function
DROP POLICY IF EXISTS "Priv roles can manage all checklist items" ON public.trip_checklists;

CREATE POLICY "Managers can manage checklist items"
ON public.trip_checklists FOR ALL
TO authenticated
USING (public.can_manage_section(auth.uid(), 'trips'))
WITH CHECK (public.can_manage_section(auth.uid(), 'trips'));

-- Ensure all authenticated users can at least see the items
DROP POLICY IF EXISTS "Anyone can view trip checklists" ON public.trip_checklists;
CREATE POLICY "Authenticated can view checklists"
ON public.trip_checklists FOR SELECT
TO authenticated
USING (true);

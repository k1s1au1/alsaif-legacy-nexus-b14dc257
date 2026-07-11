
-- Restrict posting in Majlis (News) to only Chairman, admin, and news manager
-- 1) Update can_manage_section to be more precise if needed,
-- or just use a custom check in the policy.

-- 2) Update Majlis Insert Policy
DROP POLICY IF EXISTS "Majlis Insert Policy" ON public.majlis_posts;

CREATE POLICY "Majlis Insert Policy"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'chairman')
    OR EXISTS (
      SELECT 1 FROM public.section_heads
      WHERE user_id = auth.uid() AND section = 'majlis'
    )
  )
);

-- 3) Update Majlis Update/Delete Policies to match
DROP POLICY IF EXISTS "Majlis Update Policy" ON public.majlis_posts;
CREATE POLICY "Majlis Update Policy"
ON public.majlis_posts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'chairman')
  OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = auth.uid() AND section = 'majlis'
  )
);

DROP POLICY IF EXISTS "Majlis Delete Policy" ON public.majlis_posts;
CREATE POLICY "Majlis Delete Policy"
ON public.majlis_posts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'chairman')
  OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = auth.uid() AND section = 'majlis'
  )
);


DROP POLICY IF EXISTS "Authenticated can read posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Admins/managers can insert posts" ON public.majlis_posts;

CREATE POLICY "Read posts (complaints restricted)"
ON public.majlis_posts FOR SELECT
TO authenticated
USING (
  kind <> 'complaint'
  OR author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Insert posts by kind"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    kind = 'complaint'
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS "Authenticated can read comments" ON public.majlis_comments;
CREATE POLICY "Read comments (complaints restricted)"
ON public.majlis_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.majlis_posts p
    WHERE p.id = majlis_comments.post_id
      AND (
        p.kind <> 'complaint'
        OR p.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
  )
);

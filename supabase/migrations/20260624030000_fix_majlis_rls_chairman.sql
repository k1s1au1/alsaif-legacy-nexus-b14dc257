
-- Fix RLS for majlis_posts to empower Chairman and fix member posting
DROP POLICY IF EXISTS "Read posts (complaints restricted)" ON public.majlis_posts;
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;

-- SELECT: All can read everything except complaints (which are private to author and priv roles)
CREATE POLICY "Majlis Select Policy"
ON public.majlis_posts FOR SELECT
TO authenticated
USING (
  kind <> 'complaint'
  OR author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- INSERT: Members can post discussions/complaints. Priv roles can post anything (announcements).
CREATE POLICY "Majlis Insert Policy"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (kind IN ('discussion', 'complaint') AND pinned = false)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- UPDATE: Author or priv roles
CREATE POLICY "Majlis Update Policy"
ON public.majlis_posts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- DELETE: Author or priv roles
CREATE POLICY "Majlis Delete Policy"
ON public.majlis_posts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- Fix Comments too
DROP POLICY IF EXISTS "Read comments (complaints restricted)" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can update comments" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can delete comments" ON public.majlis_comments;

CREATE POLICY "Majlis Comments Select Policy"
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
        OR public.has_role(auth.uid(), 'chairman')
      )
  )
);

CREATE POLICY "Majlis Comments Update Policy"
ON public.majlis_comments FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

CREATE POLICY "Majlis Comments Delete Policy"
ON public.majlis_comments FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

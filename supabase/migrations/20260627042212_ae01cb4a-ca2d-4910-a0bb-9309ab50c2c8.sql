
-- Allow any authenticated member to publish discussion-kind posts (sharing/event/discussion in UI),
-- and keep announcement restricted to chairman/admin/manager. Complaints remain open to authors.
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;

CREATE POLICY "Insert posts by kind"
ON public.majlis_posts
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    kind = 'complaint'::majlis_post_kind
    OR kind = 'discussion'::majlis_post_kind
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  )
);

-- Allow section heads (events) to also publish announcements/events through the news page if needed
-- Extend events INSERT/UPDATE/DELETE to include chairman fallback already handled by can_manage_section.

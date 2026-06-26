
-- Allow chairman to insert/update/delete majlis posts and upload images
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;
CREATE POLICY "Insert posts by kind" ON public.majlis_posts
  FOR INSERT WITH CHECK (
    (author_id = auth.uid()) AND (
      kind = 'complaint'::majlis_post_kind
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;
CREATE POLICY "Author or admin/manager can update posts" ON public.majlis_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  );

DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;
CREATE POLICY "Author or admin/manager can delete posts" ON public.majlis_posts
  FOR DELETE USING (
    author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  );

-- Storage: allow chairman to upload trip images and app backgrounds
DROP POLICY IF EXISTS "Admins and managers can upload trip images" ON storage.objects;
CREATE POLICY "Admins and managers can upload trip images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update trip images" ON storage.objects;
CREATE POLICY "Admins and managers can update trip images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  ) WITH CHECK (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete trip images" ON storage.objects;
CREATE POLICY "Admins and managers can delete trip images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins upload app-backgrounds" ON storage.objects;
CREATE POLICY "admins upload app-backgrounds" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins update app-backgrounds" ON storage.objects;
CREATE POLICY "admins update app-backgrounds" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins delete app-backgrounds" ON storage.objects;
CREATE POLICY "admins delete app-backgrounds" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );


-- Update storage policies for 'trip-images' to empower Chairman and allow members to upload (for bugs/complaints)
DROP POLICY IF EXISTS "Admins and managers can upload trip images" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers can update trip images" ON storage.objects;

CREATE POLICY "Authorized upload trip images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR (auth.uid() IS NOT NULL) -- Allow all members to upload images (for bugs/news)
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Authorized update trip images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR owner = auth.uid()
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Authorized delete trip images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR owner = auth.uid()
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'app-backgrounds'
DROP POLICY IF EXISTS "admins upload app-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "admins update app-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "admins delete app-backgrounds" ON storage.objects;

CREATE POLICY "Priv roles upload app-backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Priv roles update app-backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Priv roles delete app-backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

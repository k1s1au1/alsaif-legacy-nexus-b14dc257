-- Storage policies for app-backgrounds bucket
CREATE POLICY "anyone can read app-backgrounds"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'app-backgrounds');

CREATE POLICY "admins upload app-backgrounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "admins update app-backgrounds"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "admins delete app-backgrounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );
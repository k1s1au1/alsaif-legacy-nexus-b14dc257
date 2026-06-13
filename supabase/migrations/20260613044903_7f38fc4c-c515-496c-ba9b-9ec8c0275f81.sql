CREATE POLICY "Authenticated can view trip images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'trip-images');

CREATE POLICY "Authenticated can upload trip images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-images');

CREATE POLICY "Authenticated can update own trip images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'trip-images' AND owner = auth.uid());

CREATE POLICY "Authenticated can delete own trip images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'trip-images' AND owner = auth.uid());
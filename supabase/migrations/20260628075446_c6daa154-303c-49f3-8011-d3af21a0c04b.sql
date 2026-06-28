
CREATE POLICY "view meeting presentation files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-presentations');

CREATE POLICY "manage meeting presentation files - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

CREATE POLICY "manage meeting presentation files - update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

CREATE POLICY "manage meeting presentation files - delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

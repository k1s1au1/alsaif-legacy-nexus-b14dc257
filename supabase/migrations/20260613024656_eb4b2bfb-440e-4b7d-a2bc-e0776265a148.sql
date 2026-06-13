
-- Storage RLS for chat-attachments bucket
-- File path layout: {conversation_id}/{message_id}/{filename}

CREATE POLICY "Members read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(
      auth.uid(),
      (string_to_array(name, '/'))[1]::uuid
    )
  );

CREATE POLICY "Members upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(
      auth.uid(),
      (string_to_array(name, '/'))[1]::uuid
    )
  );

CREATE POLICY "Owners or admins delete chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      owner = auth.uid()
      OR public.is_conversation_admin(
        auth.uid(),
        (string_to_array(name, '/'))[1]::uuid
      )
    )
  );

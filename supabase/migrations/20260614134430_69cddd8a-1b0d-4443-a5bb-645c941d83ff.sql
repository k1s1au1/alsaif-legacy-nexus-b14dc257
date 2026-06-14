
-- 1) Restrict Realtime subscriptions to conversation members
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can subscribe to their conversation topics" ON realtime.messages;
CREATE POLICY "Members can subscribe to their conversation topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow when topic is a conversation UUID and the user is a member,
  -- or when the topic is not a conversation channel (non-uuid topics).
  CASE
    WHEN realtime.topic() ~ '^[0-9a-fA-F-]{36}$'
      THEN public.is_conversation_member(auth.uid(), realtime.topic()::uuid)
    ELSE false
  END
);

-- 2) Restrict trip-images uploads to admins/managers
DROP POLICY IF EXISTS "Authenticated can upload trip images" ON storage.objects;
CREATE POLICY "Admins and managers can upload trip images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS "Authenticated can update trip images" ON storage.objects;
CREATE POLICY "Admins and managers can update trip images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);


-- Group send permissions
CREATE TYPE public.group_send_permission AS ENUM ('all', 'admins', 'selected');

ALTER TABLE public.conversations
  ADD COLUMN send_permission public.group_send_permission NOT NULL DEFAULT 'all';

ALTER TABLE public.conversation_participants
  ADD COLUMN can_send boolean NOT NULL DEFAULT true;

-- Helper: can the user send in this conversation?
CREATE OR REPLACE FUNCTION public.can_user_send(_user uuid, _conv uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_conversation_member(_user, _conv) THEN false
    WHEN (SELECT kind FROM public.conversations WHERE id = _conv) = 'direct' THEN true
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'all' THEN true
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'admins'
      THEN public.is_conversation_admin(_user, _conv)
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'selected'
      THEN public.is_conversation_admin(_user, _conv) OR EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = _conv AND user_id = _user AND can_send = true
      )
    ELSE false
  END;
$$;

-- Replace messages INSERT policy to enforce send permission
DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_user_send(auth.uid(), conversation_id)
  );

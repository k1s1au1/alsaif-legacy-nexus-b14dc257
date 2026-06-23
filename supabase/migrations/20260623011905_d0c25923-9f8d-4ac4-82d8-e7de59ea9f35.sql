
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chairman';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_meetings';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_events';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_trips';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_finance';

DROP POLICY IF EXISTS "Members can update their own participant row" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_self_update" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can update self" ON public.conversation_participants;

CREATE POLICY "Participants self-update non-privileged"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND can_send IS NOT DISTINCT FROM (
    SELECT cp.can_send FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
  )
  AND role IS NOT DISTINCT FROM (
    SELECT cp.role FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Conversation admins manage participants"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (public.is_conversation_admin(auth.uid(), conversation_id))
WITH CHECK (public.is_conversation_admin(auth.uid(), conversation_id));

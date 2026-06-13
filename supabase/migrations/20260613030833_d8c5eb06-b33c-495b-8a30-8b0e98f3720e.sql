DROP POLICY IF EXISTS "Members view their conversations" ON public.conversations;
CREATE POLICY "Members view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_conversation_member(auth.uid(), id));

DROP FUNCTION IF EXISTS public.whoami();
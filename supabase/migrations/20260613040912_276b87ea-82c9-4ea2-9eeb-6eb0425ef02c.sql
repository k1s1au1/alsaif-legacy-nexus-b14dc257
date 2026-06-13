CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_read_at timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_member(v_user_id, _conversation_id) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = v_read_at
  WHERE conversation_id = _conversation_id
    AND user_id = v_user_id;

  UPDATE public.message_deliveries
  SET
    delivered_at = COALESCE(delivered_at, v_read_at),
    read_at = v_read_at
  WHERE conversation_id = _conversation_id
    AND user_id = v_user_id
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
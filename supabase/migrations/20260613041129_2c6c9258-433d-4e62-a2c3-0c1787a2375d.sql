REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
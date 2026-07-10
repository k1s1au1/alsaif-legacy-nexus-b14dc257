
-- 1. Helper to resolve storage path to public URL (assuming public buckets for simplicity in notifications)
-- Project: zqllblksdyutspauafgi
CREATE OR REPLACE FUNCTION public.resolve_storage_url(_bucket text, _path text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF _path IS NULL OR _path = '' THEN RETURN NULL; END IF;
  -- If it's already a URL, return it
  IF _path LIKE 'http%' THEN RETURN _path; END IF;

  RETURN 'https://zqllblksdyutspauafgi.supabase.co/storage/v1/object/public/' || _bucket || '/' || _path;
END;
$$;

-- 2. Update Trips Notification with Public Image URL
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'وجهة ترفيهية جديدة 🌴',
    COALESCE(NEW.title, 'تم إضافة رحلة عائلية جديدة'),
    '/trips/'||NEW.id::text,
    NULL,
    public.resolve_storage_url('trip-images', NEW.image_url) -- Construct full public URL
  );
  RETURN NEW;
END; $$;

-- 3. Update Chat Notification with Public Avatar URL
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_sender_avatar text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- Get sender name and avatar path
  SELECT
    COALESCE(arabic_name, full_name, 'عضو العائلة'),
    avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Get recipients
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  IF v_recipients IS NULL OR array_length(v_recipients, 1) = 0 THEN
    v_recipients := ARRAY[NEW.sender_id];
  END IF;

  v_preview := CASE
    WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
    WHEN NEW.kind = 'image' THEN '📷 أرسل صورة'
    WHEN NEW.kind = 'video' THEN '🎬 أرسل فيديو'
    WHEN NEW.kind = 'audio' THEN '🎙 رسالة صوتية'
    ELSE '📎 مرفق جديد'
  END;

  PERFORM public.call_send_push(
    v_sender_name,
    v_preview,
    '/chat/' || NEW.conversation_id::text,
    v_recipients,
    public.resolve_storage_url('avatars', v_sender_avatar) -- Construct full public URL
  );

  RETURN NEW;
END; $$;

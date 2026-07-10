
-- 1. تحديث المحرك الرئيسي ليدعم الصور
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _user_ids uuid[] DEFAULT NULL, _image text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  IF _image IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 2. إشعارات الرحلات بصور الوجهة
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'وجهة ترفيهية جديدة 🌴',
    COALESCE(NEW.title, 'تم إضافة رحلة عائلية جديدة'),
    '/trips/'||NEW.id::text,
    NULL,
    NEW.image_url -- تمرير صورة الرحلة
  );
  RETURN NEW;
END; $$;

-- 3. إشعارات الدردشة بصور الأعضاء
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_sender_avatar text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- جلب اسم وصورة المرسل
  SELECT
    COALESCE(arabic_name, full_name, 'عضو العائلة'),
    avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  -- جلب المستلمين
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
    v_sender_avatar -- تمرير صورة العضو
  );

  RETURN NEW;
END; $$;

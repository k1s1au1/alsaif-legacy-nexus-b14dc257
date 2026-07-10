
-- 1. المحرك الرئيسي للإرسال (تحديث للرابط والمفاتيح والمستلمين)
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _user_ids uuid[] DEFAULT NULL)
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
  -- تجهيز البيانات الأساسية
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- إذا كان هناك مستخدمين محددين (مثل المهام أو الدردشة)
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  -- إرسال الطلب فوراً
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := v_payload
  );
END;
$$;

-- 2. إشعارات المهام (إرسال فوري عند الإسناد أو التغيير)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    -- نرسل إشعار للمسؤول عن المهمة
    PERFORM public.call_send_push(
      'مهمة جديدة موكلة إليك 📋',
      COALESCE(NEW.title, 'لديك مسؤولية جديدة بانتظار إنجازك'),
      '/tasks',
      ARRAY[NEW.assignee_id]
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 3. إشعارات الدردشة (إصلاح منطق المستلمين)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- الحصول على اسم المرسل
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- الحصول على كافة المشاركين في المحادثة ما عدا المرسل
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  -- إذا لم يوجد مستلمين آخرين (مثل محادثة مع النفس للتجربة)، نرسل للمرسل نفسه للتأكد من العمل
  IF v_recipients IS NULL OR array_length(v_recipients, 1) = 0 THEN
    v_recipients := ARRAY[NEW.sender_id];
  END IF;

  -- تجهيز نص المعاينة
  v_preview := CASE
    WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50) || '...'
    WHEN NEW.kind = 'image' THEN '📷 أرسل صورة'
    WHEN NEW.kind = 'video' THEN '🎬 أرسل فيديو'
    WHEN NEW.kind = 'audio' THEN '🎙 رسالة صوتية'
    ELSE '📎 مرفق جديد'
  END;

  PERFORM public.call_send_push(
    v_sender_name,
    v_preview,
    '/chat/' || NEW.conversation_id::text,
    v_recipients
  );

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

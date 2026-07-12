
-- 1. حذف كافة المحفزات المكررة والقديمة من كافة الجداول ذات الصلة
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS trg_notify_task_created ON public.tasks;
DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
DROP TRIGGER IF EXISTS messages_after_insert ON public.messages;

-- 2. توحيد المحرك الرئيسي ليدعم الصور والتفاعل والروابط العميقة (Deep Links)
CREATE OR REPLACE FUNCTION public.call_send_push(
  _title text,
  _body text,
  _url text,
  _user_ids uuid[] DEFAULT NULL,
  _image text DEFAULT NULL,
  _category text DEFAULT NULL,
  _data jsonb DEFAULT NULL
)
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
  -- تجهيز بيانات الإشعار
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- إضافة الصورة
  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  -- إضافة المستلمين
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  -- إضافة التصنيف (للتفاعل)
  IF _category IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('category', _category);
  END IF;

  -- دمج الرابط في البيانات الإضافية لضمان وصوله للـ Action Event في التطبيق
  v_payload := v_payload || jsonb_build_object('data',
    COALESCE(_data, '{}'::jsonb) || jsonb_build_object('url', _url)
  );

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 3. تفعيل محفز الاجتماعات مع التفاعل والربط العميق
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'اجتماع عائلي جديد ✨',
    COALESCE(NEW.title, 'تم جدولة اجتماع جديد للمجلس'),
    '/meetings',
    NULL,
    NULL,
    'MEETING_INVITE',
    jsonb_build_object('meeting_id', NEW.id)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- 4. تفعيل محفز الرحلات
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'وجهة ترفيهية جديدة 🌴',
    COALESCE(NEW.title, 'تم إضافة رحلة عائلية جديدة'),
    '/trips/'||NEW.id::text
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_trip_created
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- 5. تفعيل محفز المهام
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> auth.uid() THEN
    PERFORM public.call_send_push(
      'مهمة جديدة موكلة إليك 📋',
      COALESCE(NEW.title, 'لديك مسؤولية جديدة بانتظار إنجازك'),
      '/tasks',
      ARRAY[NEW.assignee_id]
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 6. تفعيل محفز الرسائل (الدردشة)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    v_preview := CASE
      WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
      WHEN NEW.kind = 'image' THEN '📷 أرسل صورة'
      ELSE '📎 مرفق جديد'
    END;

    PERFORM public.call_send_push(
      v_sender_name,
      v_preview,
      '/chat/' || NEW.conversation_id::text,
      v_recipients
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 7. تنظيف الرموز المكررة لضمان عدم استلام إشعارين لنفس الجهاز
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.id < b.id
  AND a.token = b.token
  AND a.user_id = b.user_id;

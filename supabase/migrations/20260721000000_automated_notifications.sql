
-- 1. المحرك الرئيسي للإشعارات (المشروع الجديد: zqllblksdyutspauafgi)
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
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  IF _category IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('category', _category);
  END IF;

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

-- 2. محفز الاجتماعات (مع أزرار التفاعل)
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

DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- 3. محفز الرحلات
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'وجهة ترفيهية جديدة 🌴',
    COALESCE(NEW.title, 'تم إضافة رحلة عائلية جديدة'),
    '/trips'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trips FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- 4. محفز الرسائل (الدردشة الفورية)
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

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 5. محفز المهام
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
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
CREATE TRIGGER trg_notify_task_assigned AFTER INSERT OR UPDATE OF assignee_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 6. محفز الأخبار
CREATE OR REPLACE FUNCTION public.notify_majlis_post_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_name text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_author_name
  FROM public.profiles WHERE id = NEW.author_id;

  PERFORM public.call_send_push(
    CASE WHEN NEW.kind = 'announcement' THEN 'إعلان رسمي 📢' ELSE 'خبر جديد في المجلس 🗞️' END,
    COALESCE(NEW.title, 'تحديث جديد من ' || v_author_name),
    '/majlis'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_majlis_post_created ON public.majlis_posts;
CREATE TRIGGER trg_notify_majlis_post_created AFTER INSERT ON public.majlis_posts FOR EACH ROW EXECUTE FUNCTION public.notify_majlis_post_created();

-- 7. محفز الألبوم
CREATE OR REPLACE FUNCTION public.notify_archive_item_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uploader_name text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_uploader_name
  FROM public.profiles WHERE id = NEW.uploader_id;

  PERFORM public.call_send_push(
    'ذكريات جديدة في ألبوم العائلة ✨',
    v_uploader_name || ' أضاف صوراً جديدة.. شاهدها الآن!',
    '/archive'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_archive_item_created ON public.archive_items;
CREATE TRIGGER trg_notify_archive_item_created AFTER INSERT ON public.archive_items FOR EACH ROW EXECUTE FUNCTION public.notify_archive_item_created();

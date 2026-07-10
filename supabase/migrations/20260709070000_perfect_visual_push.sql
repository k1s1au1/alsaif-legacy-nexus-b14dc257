
-- 1. جعل مجلدات الصور عامة لضمان تحميلها في الإشعارات
UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'trip-images');

-- 2. تحديث المحرك الرئيسي لضمان ترتيب البيانات (Title, Body, Url, UserIds, Image)
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

  -- إضافة الصورة إذا وجدت
  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  -- إضافة المستلمين إذا وجدوا
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

-- 3. إشعارات المهام (إصلاح ترتيب البيانات وإضافة صورة)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_avatar text;
BEGIN
  -- جلب صورة الشخص الذي أسند المهمة لكي تظهر في الإشعار
  SELECT avatar_url INTO v_creator_avatar FROM public.profiles WHERE id = NEW.created_by;

  IF NEW.assignee_id IS NOT NULL THEN
    PERFORM public.call_send_push(
      'مهمة جديدة موكلة إليك 📋',
      COALESCE(NEW.title, 'لديك مسؤولية جديدة بانتظار إنجازك'),
      '/tasks',
      ARRAY[NEW.assignee_id], -- المستلم (الرابع)
      public.resolve_storage_url('avatars', v_creator_avatar) -- الصورة (الخامس)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 4. إعادة تطبيق محفزات الدردشة والرحلات لضمان استخدام المحرك الجديد
-- (سيتم استخدام الدوال التي تم تعريفها سابقاً ولكنها ستعمل الآن مع المحرك المحدث)

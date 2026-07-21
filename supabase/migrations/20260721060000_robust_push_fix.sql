
-- 1. التأكد من أن وظيفة الإرسال لا تنهار إذا غاب المخطط net
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
-- أزلنا "net" من هنا لمنع خطأ "schema does not exist" عند الاستدعاء
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
  v_net_exists boolean;
BEGIN
  -- التحقق من وجود مخطط net والإضافة قبل أي شيء
  SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') INTO v_net_exists;

  IF NOT v_net_exists THEN
    RAISE WARNING 'Extension pg_net is not installed or schema "net" is missing. Skipping notification.';
    RETURN;
  END IF;

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

  -- استخدام EXECUTE لتنفيذ الأمر بشكل ديناميكي لتجنب أخطاء وقت التصميم (Compile-time)
  BEGIN
    EXECUTE 'SELECT net.http_post(
      url := $1,
      headers := $2,
      body := $3
    )' USING v_endpoint,
             jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
             v_payload;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push notification execution failed: %', SQLERRM;
  END;
END; $$;

-- 2. تحديث تريجر الاجتماعات ليكون محمياً أيضاً
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Meeting notification trigger failed safely: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;

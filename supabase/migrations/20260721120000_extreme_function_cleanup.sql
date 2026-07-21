
-- 1. تنظيف شامل وعنيف لكافة محفزات الإشعارات لضمان عدم توقف عمليات الحفظ
DO $$
DECLARE
    trg_record RECORD;
BEGIN
    FOR trg_record IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table IN ('meetings', 'trips', 'majlis_posts', 'tasks', 'messages', 'archive_items', 'member_posts')
        AND trigger_name LIKE 'trg_notify_%'
    )
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_record.trigger_name) || ' ON public.' || quote_ident(trg_record.event_object_table);
    END LOOP;
END $$;

-- 2. حذف كافة وظائف notify_... التي قد تكون متبقية وتسبب تعارض
DROP FUNCTION IF EXISTS public.notify_meeting_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_trip_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_majlis_post_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_task_assigned() CASCADE;
DROP FUNCTION IF EXISTS public.notify_message_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_archive_item_created() CASCADE;

-- 3. الحل النهائي لمشكلة "call_send_push is not unique"
-- سنقوم بحذف كافة الوظائف بهذا الاسم بغض النظر عن عدد أو نوع البارامترات
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN (
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'call_send_push'
        AND pronamespace = 'public'::regnamespace
    )
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- 4. الآن ننشئ نسخة واحدة فقط، نظيفة ومحمية 100%
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
  -- حماية كاملة ضد أخطاء السكيما net
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
      v_payload := jsonb_build_object(
        'title', _title,
        'body', _body,
        'url', _url
      );

      IF _image IS NOT NULL AND _image <> '' THEN v_payload := v_payload || jsonb_build_object('image', _image); END IF;
      IF _user_ids IS NOT NULL THEN v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids)); END IF;
      IF _category IS NOT NULL THEN v_payload := v_payload || jsonb_build_object('category', _category); END IF;

      v_payload := v_payload || jsonb_build_object('data', COALESCE(_data, '{}'::jsonb) || jsonb_build_object('url', _url));

      EXECUTE 'SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || $2),
        body := $3
      )' USING v_endpoint, v_key, v_payload;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed safely: %', SQLERRM;
  END;
END; $$;

-- 5. إعادة بناء وظائف التريجر بشكل مبسط ومحمي
CREATE OR REPLACE FUNCTION public.notify_meeting_created() RETURNS trigger AS $$
BEGIN
  PERFORM public.call_send_push('اجتماع عائلي جديد ✨', COALESCE(NEW.title, 'تحديث جديد'), '/meetings', NULL, NULL, 'MEETING_INVITE', jsonb_build_object('meeting_id', NEW.id));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_trip_created() RETURNS trigger AS $$
BEGIN
  PERFORM public.call_send_push('وجهة ترفيهية جديدة 🌴', COALESCE(NEW.title, 'رحلة جديدة'), '/trips');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_majlis_post_created() RETURNS trigger AS $$
BEGIN
  PERFORM public.call_send_push(
    CASE WHEN NEW.kind = 'announcement' THEN 'إعلان رسمي 📢' ELSE 'خبر جديد في المجلس 🗞️' END,
    COALESCE(NEW.title, 'تحديث جديد'),
    '/majlis'
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 6. إعادة ربط التريجرات
CREATE TRIGGER trg_notify_meeting_created AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trips FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();
CREATE TRIGGER trg_notify_majlis_post_created AFTER INSERT ON public.majlis_posts FOR EACH ROW EXECUTE FUNCTION public.notify_majlis_post_created();

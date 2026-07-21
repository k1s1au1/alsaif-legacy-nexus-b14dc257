
-- 1. تنظيف شامل لكافة المحفزات (Triggers) في جميع الجداول المتأثرة
DO $$
DECLARE
    trg_record RECORD;
BEGIN
    FOR trg_record IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table IN ('meetings', 'trips', 'majlis_posts', 'tasks', 'messages', 'archive_items', 'member_posts')
    )
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_record.trigger_name) || ' ON public.' || quote_ident(trg_record.event_object_table);
    END LOOP;
END $$;

-- 2. حذف كافة النسخ المكررة من وظيفة call_send_push بكل تواقيعها المختلفة
-- نستخدم CASCADE للتأكد من حذف أي شيء مرتبط بها
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid[], text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text) CASCADE;

-- 3. إعادة بناء المحرك الموحد والوحيد للإشعارات بأعلى درجات الأمان
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
BEGIN
  -- استخدام تنفيذ ديناميكي وحماية كاملة ضد غياب مخطط net
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
      EXECUTE 'SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4''
        ),
        body := $2
      )' USING 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push',
               jsonb_build_object(
                 'title', _title,
                 'body', _body,
                 'url', _url,
                 'image', _image,
                 'user_ids', _user_ids,
                 'category', _category,
                 'data', COALESCE(_data, '{}'::jsonb) || jsonb_build_object('url', _url)
               );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push notification skipped: %', SQLERRM;
  END;
END; $$;

-- 4. إعادة بناء وظائف التريجر بشكل موحد ومحمي
CREATE OR REPLACE FUNCTION public.notify_meeting_created() RETURNS trigger AS $$
BEGIN
  PERFORM public.call_send_push('اجتماع عائلي جديد ✨', COALESCE(NEW.title, 'اجتماع جديد'), '/meetings', NULL, NULL, 'MEETING_INVITE', jsonb_build_object('meeting_id', NEW.id));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_trip_created() RETURNS trigger AS $$
BEGIN
  PERFORM public.call_send_push('وجهة ترفيهية جديدة 🌴', COALESCE(NEW.title, 'رحلة عائلة جديدة'), '/trips');
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

-- 5. إعادة ربط التريجرات الأساسية
CREATE TRIGGER trg_notify_meeting_created AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trips FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();
CREATE TRIGGER trg_notify_majlis_post_created AFTER INSERT ON public.majlis_posts FOR EACH ROW EXECUTE FUNCTION public.notify_majlis_post_created();

-- 6. إضافة تريجرات الوقت لضمان عمل الجداول
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS meetings_set_updated_at ON public.meetings;
CREATE TRIGGER meetings_set_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

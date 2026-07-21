
-- 1. حذف التريجر والوظائف القديمة للتخلص من أي ارتباطات خاطئة
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
DROP FUNCTION IF EXISTS public.notify_meeting_created();
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid[], text, text, jsonb);

-- 2. إعادة إنشاء وظيفة الإرسال بأقصى درجات الأمان وبدون الإشارة لـ net في التعريف
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
SET search_path = public, extensions -- لا يوجد "net" هنا أبداً
AS $$
BEGIN
  -- استخدام EXECUTE للتحقق من المخطط والإرسال بشكل ديناميكي 100%
  -- هذا يمنع الخطأ عند "ترجمة" الوظيفة
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
      EXECUTE 'SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4''
        ),
        body := $2
      )' USING ''https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push'',
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
    -- صمت تام في حال فشل الإشعارات لضمان نجاح الحفظ
    RAISE WARNING 'Push notification skipped safely: %', SQLERRM;
  END;
END; $$;

-- 3. إعادة إنشاء تريجر الاجتماعات بشكل محمي
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
    NULL; -- تجاهل أي خطأ
  END;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_meeting_created
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

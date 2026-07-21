
-- تفعيل المخططات والإضافات اللازمة للمشروع الجديد
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS net;

-- تفعيل إضافة pg_net إذا كانت متوفرة في بيئة Supabase
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Could not enable pg_net extension: %', SQLERRM;
END $$;

-- التأكد من أن وظيفة call_send_push تستخدم الإعدادات الصحيحة
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

  -- محاولة الإرسال بأمان شديد
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'net') THEN
      PERFORM net.http_post(
        url := v_endpoint,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key,
          'apikey', v_key
        ),
        body := v_payload
      );
    ELSIF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'extensions') THEN
      PERFORM extensions.http_post(
        url := v_endpoint,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key,
          'apikey', v_key
        ),
        body := v_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
  END;
END; $$;

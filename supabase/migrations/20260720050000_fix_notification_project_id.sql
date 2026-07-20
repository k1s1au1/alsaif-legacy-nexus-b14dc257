
-- تحديث دالة إرسال الإشعارات لتستخدم معرف المشروع الصحيح
-- Project: wzgzkyzpzniduwcgdozl

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
  -- تم التحديث للمشروع الحالي
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  -- مفتاح الـ Anon الخاص بمشروعك
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
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

  -- دمج الرابط في البيانات الإضافية
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

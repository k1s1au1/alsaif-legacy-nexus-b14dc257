
-- تنظيف شامل لجدول الاجتماعات من أي تريجرات قد تسبب خطأ schema net
DO $$
DECLARE
    trg_record RECORD;
BEGIN
    FOR trg_record IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = 'meetings'
    )
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg_record.trigger_name) || ' ON public.' || quote_ident(trg_record.event_object_table);
    END LOOP;
END $$;

-- حذف الوظائف التي قد تكون مرتبطة بالإشعارات وتسبب التعارض
DROP FUNCTION IF EXISTS public.call_send_push CASCADE;
DROP FUNCTION IF EXISTS public.notify_meeting_created CASCADE;
DROP FUNCTION IF EXISTS public.send_meeting_notification CASCADE;

-- إعادة إنشاء وظيفة تحديث الوقت الأساسية
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تفعيل تريجر الوقت فقط لضمان عمل الجدول بشكل طبيعي
CREATE TRIGGER meetings_set_updated_at
    BEFORE UPDATE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- التأكد من أن الجدول متاح للجميع (حسب سياسات RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

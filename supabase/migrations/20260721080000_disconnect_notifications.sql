
-- 1. حذف كافة المحفزات (Triggers) المرتبطة بجدول الاجتماعات فوراً
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
DROP TRIGGER IF EXISTS trg_notify_meeting_created_v2 ON public.meetings;
DROP TRIGGER IF EXISTS meetings_notification_trigger ON public.meetings;

-- 2. حذف أي وظائف قد تكون مرتبطة بالإشعارات في هذا الجدول
DROP FUNCTION IF EXISTS public.notify_meeting_created();
DROP FUNCTION IF EXISTS public.send_meeting_notification();

-- 3. إنشاء وظيفة "فارغة" لا تفعل شيئاً سوى إرجاع البيانات (لضمان استقرار النظام إذا طلبها شيء آخر)
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger AS $$
BEGIN
  -- لا تفعل شيئاً، فقط اسمح بالحفظ
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. إعادة ربط التريجر بشكل "صامت" تماماً ولا يطلب أي schema خارجي
CREATE TRIGGER trg_notify_meeting_created
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_meeting_created();

-- 5. تعطيل أي قيود (Constraints) قد تكون مرتبطة بـ net بشكل غير مباشر (إن وجدت)
-- (لا توجد قيود مباشرة عادة، ولكن هذا الإجراء للتنظيف)

# إصلاح خطأ الـ Edge Function وتحسين نظام الإشعارات

تم تشخيص المشكلة بوجود رابط مشروع قديم (Hardcoded Project ID) في دوال قاعدة البيانات، مما يتسبب في فشل إرسال الإشعارات التلقائية. كما سنقوم بتحسين استجابة الـ Edge Function لضمان وضوح الأخطاء.

## User Review Required

> [!IMPORTANT]
> - سأقوم بتحديث كود قاعدة البيانات ليستخدم رابط مشروعك الحالي (`wzgzkyzpzniduwcgdozl`).
> - يرجى التأكد من إضافة مفتاح `FCM_SERVICE_ACCOUNT` (بصيغة JSON) في إعدادات Supabase (Secrets) ليعمل نظام الإشعارات بشكل صحيح.

## Proposed Changes

### 1. إصلاح دوال قاعدة البيانات (SQL Fix)

#### [NEW] [fix_notification_project_id.sql](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/supabase/migrations/20260720050000_fix_notification_project_id.sql)
- تحديث دالة `call_send_push` لتشير إلى المشروع الصحيح.
- تحديث مفتاح الـ API المستخدم في الطلبات الداخلية.

### 2. تحسين مرونة الـ Edge Function

#### [MODIFY] [index.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/supabase/functions/send-push/index.ts)
- إضافة تحققات إضافية لضمان عدم انهيار الدالة قبل الـ `try-catch`.
- تحسين رسائل الخطأ لتكون أكثر وضوحاً في حال نقص الإعدادات.

### 3. تحسين واجهة الإعدادات

#### [MODIFY] [settings.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/settings.tsx)
- تحسين التعامل مع أخطاء الـ Edge Function وعرض رسائل تنبيهية ترشد المستخدم لما يجب فعله (مثل التأكد من الـ Secrets).

## Verification Plan

### Automated Tests
- التأكد من خلو ملفات الـ SQL من أي معرّفات مشاريع قديمة (`zqllblksdyutspauafgi`).

### Manual Verification
- تجربة الضغط على زر "إرسال تجربة" في صفحة الإعدادات بعد الرفع والتأكد من ظهور رسالة خطأ واضحة أو نجاح الإرسال.

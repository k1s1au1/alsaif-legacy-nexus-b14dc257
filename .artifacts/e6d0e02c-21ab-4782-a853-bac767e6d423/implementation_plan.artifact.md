# خطة تحسين الأداء وتوسيع نظام الإشعارات

تهدف هذه الخطة إلى تحسين سرعة استجابة لوحة التحكم (Dashboard) وتوسيع نطاق الإشعارات التفاعلية لتشمل ألبوم الصور والاجتماعات المرتقبة.

## User Review Required

> [!IMPORTANT]
> - سأقوم بتحويل نظام جلب البيانات في لوحة التحكم من `useEffect` التقليدي إلى `TanStack Query` لضمان أفضل أداء وتخزين مؤقت (Caching).
> - تفعيل الإشعارات لصور الألبوم يتطلب إضافة "Triggers" في قاعدة البيانات (Supabase).
> - بالنسبة لتنبيهات "اقتراب موعد الاجتماع"، سنعتمد حالياً على إرسال إشعار فوري عند إنشاء الاجتماع، مع إمكانية إضافة نظام جدولة (Cron Job) إذا كانت بيئة Supabase تدعم ذلك.

## Proposed Changes

### 1. تحسين الأداء (Dashboard Optimization)

#### [MODIFY] [dashboard.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/dashboard.tsx)
- استبدال `loadData` بسلسلة من خطافات `useQuery`.
- تقسيم البيانات إلى استعلامات منفصلة (Profile, Stats, Meetings, Trips, Announcements) لضمان تحميل الأجزاء الجاهزة أولاً.
- الاستفادة من `staleTime` لتقليل الطلبات المتكررة عند التنقل بين الصفحات.

### 2. توسيع نظام الإشعارات (Push Notifications Expansion)

#### [NEW] [notifications_triggers.sql](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/supabase/migrations/20260720000000_expand_notifications.sql)
- إضافة وظيفة `notify_archive_item_created` لإرسال إشعار عند إضافة صور أو فيديوهات جديدة للألبوم.
- إضافة "Trigger" على جدول `archive_items`.
- تحسين وظيفة `notify_meeting_created` لضمان وصولها لجميع أفراد العائلة بشكل صحيح.

#### [MODIFY] [meetings.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/meetings.tsx)
- (اختياري) إضافة زر للمسؤولين لإعادة إرسال تنبيه يدوي للاجتماع (Reminder) في حال اقتراب الموعد.

## Verification Plan

### Automated Tests
- التأكد من عدم وجود أخطاء في الـ Console عند تحميل لوحة التحكم.
- التحقق من تخزين البيانات في `TanStack Query DevTools`.

### Manual Verification
- تجربة إضافة صورة للألبوم والتأكد من وصول الإشعار (في حال توفر بيئة اختبار).
- مراقبة سرعة تحميل لوحة التحكم مقارنة بالوضع السابق.

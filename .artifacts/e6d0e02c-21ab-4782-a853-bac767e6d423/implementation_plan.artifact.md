# خطة تطوير ميزات الأندرويد: Health Connect و Google Assistant

تهدف هذه الخطة إلى تعزيز قدرات تطبيق الأندرويد من خلال التكامل مع نظام الصحة من جوجل ودعم الأوامر الصوتية.

## التغييرات المقترحة

### 1. التكامل مع Health Connect (مزامنة الخطوات)
بدلاً من توليد أرقام عشوائية، سنقوم بربط التطبيق بمحرك الصحة من جوجل لسحب الخطوات الحقيقية من الساعات الذكية والتطبيقات الرياضية الأخرى.

#### [MODIFY] [package.json](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/package.json)
- إضافة مكتبة `@awesome-cordova-plugins/health` أو `capacitor-health-connect` (سأعتمد على مكتبة مستقرة تدعم أندرويد 14+).

#### [MODIFY] [AndroidManifest.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/AndroidManifest.xml)
- إضافة تصريح الوصول للخطوات: `androidx.health.permission.read.STEPS`.
- إضافة `intent-filter` للتعامل مع طلبات فتح Health Connect.

#### [MODIFY] [steps-challenge.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/steps-challenge.tsx)
- استبدال منطق المزامنة العشوائي بطلب البيانات الفعلي من الحساسات عبر المكتبة الجديدة.

---

### 2. الأوامر الصوتية (Google Assistant App Actions)
تمكين المستخدم من قول "Hey Google, open Al-Saif meeting" لفتح قسم الاجتماعات مباشرة.

#### [NEW] [shortcuts.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/res/xml/shortcuts.xml)
- تعريف الـ `capability` الخاصة بالفتح السريع للأقسام.
- ربط الأوامر الصوتية بروابط عميقة (Deep Links).

#### [MODIFY] [AndroidManifest.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/AndroidManifest.xml)
- تعريف ملف `shortcuts.xml` في الـ `meta-data`.
- إضافة `intent-filter` للرابط العميق `alsaif://`.

#### [MODIFY] [capacitor-client.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/capacitor-client.tsx)
- إضافة مستمع (Listener) للروابط العميقة وتوجيه المستخدم للصفحة المطلوبة عند تفعيل الأمر الصوتي.

## Verification Plan

### Manual Verification
- **Health Connect:** الضغط على زر "مزامنة" والتأكد من ظهور واجهة طلب الإذن من جوجل، ثم التأكد من سحب رقم الخطوات الصحيح.
- **App Actions:** محاكاة أمر صوتي (عبر Android Studio Assistant Tool) للتأكد من فتح صفحة الاجتماعات أو تحدي الخطوات مباشرة.

> [!IMPORTANT]
> ميزة Health Connect تتطلب وجود تطبيق Health Connect مثبت على الجوال (مدمج في أندرويد 14، ومنفصل في الإصدارات الأقدم).

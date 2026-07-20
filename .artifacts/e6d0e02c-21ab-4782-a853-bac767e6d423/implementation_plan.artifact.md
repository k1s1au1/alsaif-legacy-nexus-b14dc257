# خطة تفعيل "حساسات الخطوات الحقيقية" في الأندرويد

تهدف هذه الخطة إلى استبدال الأرقام العشوائية في تحدي الخطوات ببيانات حقيقية مستمدة من حساسات الجوال (Pedometer) مباشرة، مع تفعيل المزامنة التلقائية.

## التغييرات المقترحة

### 1. إنشاء "جسر برمجي" للخطوات (Android Native Bridge)
بما أن الكود الحالي يستخدم محاكاة، سنقوم ببناء إضافة (Plugin) خاصة للأندرويد بلغة Java للتحدث مع حساسات الجوال.

#### [NEW] [StepsPlugin.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/StepsPlugin.java)
- بناء كود برمي للوصول إلى `SensorManager` في الأندرويد.
- استخدام `Sensor.TYPE_STEP_COUNTER` لجلب إجمالي الخطوات التي قطعها المستخدم اليوم.
- إضافة دالة `getTodaySteps()` لتعيد الرقم الحقيقي للتطبيق.

#### [MODIFY] [MainActivity.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/MainActivity.java)
- تسجيل الإضافة الجديدة `StepsPlugin` لكي يتمكن كود React من مناداتها.

### 2. ربط الواجهة بالحساسات الحقيقية
#### [MODIFY] [steps-challenge.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/steps-challenge.tsx)
- استبدال دالة الحساب العشوائي بطلب برمجي من الإضافة الجديدة: `registerPlugin('StepsPlugin').getTodaySteps()`.
- تحديث منطق "المزامنة التلقائية" ليعمل كلما تم فتح الصفحة أو العودة للتطبيق.

### 3. تحسين نظام الصلاحيات
- التأكد من طلب إذن "النشاط البدني" (Physical Activity) بشكل صحيح في الأندرويد قبل محاولة قراءة الحساسات.

## Verification Plan

### Manual Verification
1. **اختبار الحساس:** المشي بضع خطوات والجوال في اليد، ثم الضغط على مزامنة والتأكد من زيادة الرقم بدقة (وليس عشوائياً).
2. **المزامنة التلقائية:** إغلاق التطبيق وفتحه، والتأكد من تحديث الخطوات في الخلفية وبدء الـ Loader تلقائياً.
3. **التأكد من الأرقام:** مقارنة الرقم في التطبيق مع عداد الخطوات في نظام الأندرويد (مثل Google Fit أو Samsung Health).

---

**هل أنت موافق على البدء في كتابة كود الـ Java لربط الحساسات الحقيقية؟** سأقوم بعدها برفع التحديثات (PUSH).

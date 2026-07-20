# خطة إصلاح الهوية البصرية والإحصائيات الحية

تهدف هذه الخطة إلى جعل شعار الموقع وخلفية صفحة الدخول قابلة للتغيير بالكامل من الإعدادات، مع ضمان ظهورها للزوار، وإصلاح مشكلة تصفير الإحصائيات.

## التغييرات المقترحة

### 1. إصلاح ظهور الشعار والخلفية للزوار (Public Access)
- **المشكلة:** الزوار لا يملكون صلاحية قراءة جدول الإعدادات أو رؤية الصور المرفوعة، لذا تظهر الصور الافتراضية أو تختفي.
- **الحل:** تفعيل سياسات الوصول العام (Public RLS) لجدول الإعدادات وحاوية الصور.

### 2. ربط صفحة الدخول بالإعدادات الديناميكية
#### [MODIFY] [auth.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/auth.tsx)
- تعديل كود الخلفية (الجهة الخضراء) لتستخدم `customBg` المرفوع من الإعدادات بدلاً من اللون الثابت.
- التأكد من أن المربع (Logo Box) يعرض الشعار المرفوع ديناميكياً.

### 3. إصلاح الإحصائيات الصفرية
- **المشكلة:** الإحصائيات تظهر 0 لأن الزوار (Anon) لا يملكون صلاحية قراءة عدد الأعضاء أو المهام.
- **الحل:** منح صلاحية `SELECT` للزوار على جداول `profiles` و `tasks`.

---

## الخطوات التنفيذية

### الخطوة الأولى: تفعيل الصلاحيات في قاعدة البيانات (SQL)
يرجى تشغيل هذا الكود لفتح "الأبواب" للزوار ليروا الهوية الجديدة:

```sql
-- 1. السماح للجميع برؤية الإعدادات (الشعار والخلفية)
DROP POLICY IF EXISTS "anyone can read settings" ON public.app_settings;
CREATE POLICY "anyone can read settings" ON public.app_settings
FOR SELECT TO anon, authenticated USING (true);

-- 2. السماح للجميع برؤية ملفات الهوية في التخزين
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'app-backgrounds');

-- 3. تفعيل إحصائيات الزوار (إصلاح مشكلة الصفر)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.tasks TO anon;

-- منح الوصول العام لجدول المهام والأعضاء لغرض العد فقط
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read tasks" ON public.tasks;
CREATE POLICY "Public read tasks" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
```

### الخطوة الثانية: تحديث كود صفحة الدخول (PUSH)
سأقوم بتعديل ملف `auth.tsx` لربط الجهة الخضراء بالصورة المرفوعة.

---

**هل نبدأ بتطبيق هذه الإصلاحات؟** سأقوم برفع الكود فوراً لتعمل الصور الديناميكية.

# خطة الترقية البصرية: ثيم العود والنمط الملكي المطور

تركز هذه الخطة على إضافة ثيم "العود الملكي" وتطوير "النمط الملكي" بإضافة زخارف ولمسات بصرية فاخرة.

## التغييرات المقترحة

### 1. إضافة ثيم "العود الملكي" (Royal Oud)
#### [MODIFY] [themes.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/lib/themes.ts)
- إضافة إعدادات لونية جديدة تعتمد على البني العميق (Deep Espresso) والبرونز.
- تحديث الـ Mesh Gradient ليعطي شعوراً بالدفء والفخامة التراثية.

### 2. تطوير "النمط الملكي" (Enhanced Royal Mode)
#### [MODIFY] [styles.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/styles.css)
- **Heading Shimmer**: إضافة تحريك (Animation) لمرور لمعة ذهبية على العناوين الكبيرة عند تفعيل النمط الملكي.
- **Ornaments Layout**: تعريف الأنماط الخاصة بالزخارف الجانبية في زوايا الشاشة.

#### [MODIFY] [app-shell.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/components/app-shell.tsx)
- إضافة عناصر زخرفية (SVG Ornaments) تظهر فقط عندما يحتوي وسم الـ `html` على كلاس `font-royal-mode`.
- ستكون الزخارف خفيفة في زوايا التطبيق لتعطي طابعاً رسمياً دون إزعاج المستخدم.

## Verification Plan

### Manual Verification
1. الانتقال للإعدادات واختيار لون "العود الملكي".
2. تفعيل "النمط الملكي" والتأكد من ظهور الزخارف في زوايا الشاشة.
3. التأكد من أن الزخارف لا تغطي الأزرار الهامة في نسخة الجوال.

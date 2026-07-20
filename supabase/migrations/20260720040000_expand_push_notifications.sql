
-- 1. إشعار عند إضافة صور/فيديوهات جديدة للألبوم (الأرشيف)
CREATE OR REPLACE FUNCTION public.notify_archive_item_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uploader_name text;
  v_section_name text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_uploader_name
  FROM public.profiles WHERE id = NEW.uploader_id;

  v_section_name := CASE
    WHEN NEW.section = 'family' THEN 'ألبوم العائلة'
    WHEN NEW.section = 'meetings' THEN 'اجتماعاتنا'
    WHEN NEW.section = 'events' THEN 'فعاليات العائلة'
    WHEN NEW.section = 'trips' THEN 'رحلاتنا'
    ELSE 'الأرشيف'
  END;

  PERFORM public.call_send_push(
    'ذكريات جديدة في ' || v_section_name || ' ✨',
    v_uploader_name || ' أضاف صوراً جديدة للألبوم.. شاهدها الآن!',
    '/archive',
    NULL, -- إرسال للجميع
    NULL, -- يمكن تطويرها لإرسال صورة مصغرة إذا كانت مخزنة في DB
    NULL,
    jsonb_build_object('section', NEW.section)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_archive_item_created ON public.archive_items;
CREATE TRIGGER trg_notify_archive_item_created
AFTER INSERT ON public.archive_items
FOR EACH ROW EXECUTE FUNCTION public.notify_archive_item_created();


-- 2. إشعار عند إضافة أخبار أو إعلانات جديدة في المجلس
CREATE OR REPLACE FUNCTION public.notify_majlis_post_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_name text;
  v_title text;
  v_label text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_author_name
  FROM public.profiles WHERE id = NEW.author_id;

  v_label := CASE
    WHEN NEW.kind = 'announcement' THEN 'إعلان رسمي 📢'
    ELSE 'خبر جديد في المجلس 🗞️'
  END;

  v_title := COALESCE(NEW.title, 'تحديث جديد');

  PERFORM public.call_send_push(
    v_label,
    v_title || ' - كتبه ' || v_author_name,
    '/majlis'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_majlis_post_created ON public.majlis_posts;
CREATE TRIGGER trg_notify_majlis_post_created
AFTER INSERT ON public.majlis_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_majlis_post_created();


-- 1. جداول إضافية هامة لضمان عمل كافة أقسام الموقع
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date TIMESTAMPTZ,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  assignee_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'todo',
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.archive_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES public.profiles(id),
  storage_path TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  section TEXT DEFAULT 'family',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. نظام الصلاحيات التلقائي (تعديل لضمان التوافق)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, arabic_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'arabic_name')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    arabic_name = EXCLUDED.arabic_name;

  -- ترقية أول مستخدم (أنت) ليكون مدير
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. تفعيل الحماية والوصول (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read All Roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read All Trips" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read All Tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read All Archive" ON public.archive_items FOR SELECT TO authenticated USING (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated, service_role;

-- FINAL CLEAN STATE SCHEMA (V12 - NO HISTORICAL NOISE)
SET client_encoding = 'UTF8';
SET check_function_bodies = false;


DO $$
BEGIN
    EXECUTE 'DROP SCHEMA IF EXISTS public CASCADE';
    EXECUTE 'CREATE SCHEMA public';
    EXECUTE 'GRANT ALL ON SCHEMA public TO postgres';
    EXECUTE 'GRANT ALL ON SCHEMA public TO public';
    EXECUTE 'GRANT ALL ON SCHEMA public TO anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN
    -- If we can't drop the schema, we'll just try to continue and create tables IF NOT EXISTS
    RAISE NOTICE 'Could not drop schema, continuing with table creation...';
END $$;


-- Essential Enums
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member', 'chairman');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    arabic_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Majlis Posts
CREATE TABLE IF NOT EXISTS public.majlis_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id),
    title TEXT,
    body TEXT,
    kind TEXT DEFAULT 'announcement',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Steps Challenge
CREATE TABLE IF NOT EXISTS public.steps_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    steps INTEGER DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, date)
);

-- Fund Transactions
CREATE TABLE IF NOT EXISTS public.fund_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.majlis_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transactions ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read majlis" ON public.majlis_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users view steps" ON public.steps_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage steps" ON public.steps_data FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Standard Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated, service_role;

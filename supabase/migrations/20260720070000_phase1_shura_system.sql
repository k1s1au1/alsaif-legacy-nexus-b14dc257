
-- 1. Expand app_role enum
DO $$ BEGIN
    ALTER TYPE public.app_role ADD VALUE 'head_meetings';
    ALTER TYPE public.app_role ADD VALUE 'head_events';
    ALTER TYPE public.app_role ADD VALUE 'head_trips';
    ALTER TYPE public.app_role ADD VALUE 'head_finance';
    ALTER TYPE public.app_role ADD VALUE 'head_heritage';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Section Heads Table
CREATE TABLE IF NOT EXISTS public.section_heads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('meetings','events','trips','finance','heritage','majlis','community')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);
ALTER TABLE public.section_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view section heads" ON public.section_heads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins/chairman manage section heads" ON public.section_heads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- 3. can_manage_section function
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user
      AND role IN ('admin'::app_role, 'manager'::app_role, 'chairman'::app_role)
  ) OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = _user AND section = _section
  );
$$;

-- 4. Member community posts
CREATE TABLE IF NOT EXISTS public.member_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'diary',
  title text NOT NULL,
  body text,
  image_urls text[] NOT NULL DEFAULT '{}',
  poll_options jsonb,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read posts" ON public.member_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members create own posts" ON public.member_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or section head update" ON public.member_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'))
  WITH CHECK (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'));
CREATE POLICY "Author or section head delete" ON public.member_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'));

-- 5. Member Post Comments
CREATE TABLE IF NOT EXISTS public.member_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read comments" ON public.member_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members write own comments" ON public.member_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- 6. Member Post Votes
CREATE TABLE IF NOT EXISTS public.member_post_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_id)
);
ALTER TABLE public.member_post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read votes" ON public.member_post_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members cast own vote" ON public.member_post_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);

-- 7. Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated, service_role;

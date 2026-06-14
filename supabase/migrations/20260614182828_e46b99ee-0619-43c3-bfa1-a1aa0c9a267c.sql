
CREATE TYPE public.majlis_post_kind AS ENUM ('announcement', 'discussion');

CREATE TABLE public.majlis_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.majlis_post_kind NOT NULL DEFAULT 'discussion',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.majlis_posts TO authenticated;
GRANT ALL ON public.majlis_posts TO service_role;

ALTER TABLE public.majlis_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read posts" ON public.majlis_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/managers can insert posts" ON public.majlis_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Author or admin/manager can update posts" ON public.majlis_posts
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Author or admin/manager can delete posts" ON public.majlis_posts
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER majlis_posts_touch BEFORE UPDATE ON public.majlis_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX majlis_posts_created_idx ON public.majlis_posts (pinned DESC, created_at DESC);

CREATE TABLE public.majlis_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.majlis_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.majlis_comments TO authenticated;
GRANT ALL ON public.majlis_comments TO service_role;

ALTER TABLE public.majlis_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comments" ON public.majlis_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own comments" ON public.majlis_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "Author or admin/manager can update comments" ON public.majlis_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Author or admin/manager can delete comments" ON public.majlis_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER majlis_comments_touch BEFORE UPDATE ON public.majlis_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX majlis_comments_post_idx ON public.majlis_comments (post_id, created_at);

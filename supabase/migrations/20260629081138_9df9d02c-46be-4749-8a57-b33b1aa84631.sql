
-- Member community posts
CREATE TABLE public.member_posts (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_posts TO authenticated;
GRANT ALL ON public.member_posts TO service_role;
ALTER TABLE public.member_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read posts" ON public.member_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members create own posts" ON public.member_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or section head update" ON public.member_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'))
  WITH CHECK (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'));
CREATE POLICY "Author or section head delete" ON public.member_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'));
CREATE TRIGGER trg_member_posts_updated BEFORE UPDATE ON public.member_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Comments
CREATE TABLE public.member_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_post_comments TO authenticated;
GRANT ALL ON public.member_post_comments TO service_role;
ALTER TABLE public.member_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read comments" ON public.member_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members write own comments" ON public.member_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author or section head delete comment" ON public.member_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.can_manage_section(auth.uid(), 'community'));

-- Votes
CREATE TABLE public.member_post_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_post_votes TO authenticated;
GRANT ALL ON public.member_post_votes TO service_role;
ALTER TABLE public.member_post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read votes" ON public.member_post_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members cast own vote" ON public.member_post_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Members change own vote" ON public.member_post_votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Members delete own vote" ON public.member_post_votes FOR DELETE TO authenticated
  USING (auth.uid() = voter_id);

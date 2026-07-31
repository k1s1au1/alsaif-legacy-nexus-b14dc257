/*
# Phase 6: Community Board (Majlis & Member Posts)

1. New Tables

### majlis_posts
The family council board for announcements, discussions, and complaints.
Columns: id, title, body, kind (announcement/discussion/complaint), pinned,
image_url, created_by, created_at.

### majlis_comments
Threaded comments on majlis posts.
Columns: id, post_id, body, created_by, created_at.

### member_posts
Member-facing social board with support for polls and images.
Columns: id, title, body, image_url, poll_options (jsonb array), created_by, created_at.

### member_post_comments
Comments on member posts.
Columns: id, post_id, body, created_by, created_at.

### member_post_votes
Poll votes on member posts (one per member per post).
Columns: id, post_id, user_id, option_index, created_at.

2. Security
- majlis_posts: all authenticated can read; admin/chairman/manager can INSERT/UPDATE/DELETE.
- majlis_comments: all can read; members can INSERT own; own or admin can DELETE.
- member_posts: all can read; members can INSERT own; own or admin can UPDATE/DELETE.
- member_post_comments: all can read; members can INSERT own; own or admin can DELETE.
- member_post_votes: all can read; one vote per member per post.
*/

-- majlis_posts
CREATE TABLE IF NOT EXISTS public.majlis_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text,
  kind       text NOT NULL DEFAULT 'announcement'
               CHECK (kind IN ('announcement','discussion','complaint')),
  pinned     boolean NOT NULL DEFAULT false,
  image_url  text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.majlis_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_majlis_posts" ON public.majlis_posts;
CREATE POLICY "auth_select_majlis_posts" ON public.majlis_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_majlis_posts" ON public.majlis_posts;
CREATE POLICY "manager_insert_majlis_posts" ON public.majlis_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_update_majlis_posts" ON public.majlis_posts;
CREATE POLICY "manager_update_majlis_posts" ON public.majlis_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_majlis_posts" ON public.majlis_posts;
CREATE POLICY "manager_delete_majlis_posts" ON public.majlis_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- majlis_comments
CREATE TABLE IF NOT EXISTS public.majlis_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.majlis_posts(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.majlis_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_majlis_comments" ON public.majlis_comments;
CREATE POLICY "auth_select_majlis_comments" ON public.majlis_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_majlis_comments" ON public.majlis_comments;
CREATE POLICY "own_insert_majlis_comments" ON public.majlis_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_update_majlis_comments" ON public.majlis_comments;
CREATE POLICY "own_update_majlis_comments" ON public.majlis_comments FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_delete_majlis_comments" ON public.majlis_comments;
CREATE POLICY "own_delete_majlis_comments" ON public.majlis_comments FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- member_posts
CREATE TABLE IF NOT EXISTS public.member_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text,
  body         text,
  image_url    text,
  poll_options jsonb DEFAULT '[]'::jsonb,
  created_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_member_posts" ON public.member_posts;
CREATE POLICY "auth_select_member_posts" ON public.member_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_member_posts" ON public.member_posts;
CREATE POLICY "own_insert_member_posts" ON public.member_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_update_member_posts" ON public.member_posts;
CREATE POLICY "own_update_member_posts" ON public.member_posts FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "own_delete_member_posts" ON public.member_posts;
CREATE POLICY "own_delete_member_posts" ON public.member_posts FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- member_post_comments
CREATE TABLE IF NOT EXISTS public.member_post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_member_post_comments" ON public.member_post_comments;
CREATE POLICY "auth_select_member_post_comments" ON public.member_post_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_member_post_comments" ON public.member_post_comments;
CREATE POLICY "own_insert_member_post_comments" ON public.member_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_update_member_post_comments" ON public.member_post_comments;
CREATE POLICY "own_update_member_post_comments" ON public.member_post_comments FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_delete_member_post_comments" ON public.member_post_comments;
CREATE POLICY "own_delete_member_post_comments" ON public.member_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- member_post_votes
CREATE TABLE IF NOT EXISTS public.member_post_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES public.member_posts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.member_post_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_member_post_votes" ON public.member_post_votes;
CREATE POLICY "auth_select_member_post_votes" ON public.member_post_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_member_post_votes" ON public.member_post_votes;
CREATE POLICY "own_insert_member_post_votes" ON public.member_post_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_member_post_votes" ON public.member_post_votes;
CREATE POLICY "own_update_member_post_votes" ON public.member_post_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_member_post_votes" ON public.member_post_votes;
CREATE POLICY "own_delete_member_post_votes" ON public.member_post_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

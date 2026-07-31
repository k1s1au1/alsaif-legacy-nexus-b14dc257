/*
# Phase 7: Heritage, Archive, Vault, Family Tree

1. New Tables

### archive_items
Shared media archive for photos and videos, organized by section.
Columns: id, title, description, section (family/meetings/events/trips), media_type (image/video),
storage_path, thumbnail_url, pinned, expires_at, created_by, created_at.

### family_tree_extras
Non-authenticated family members that appear in the family tree visualization.
These are people who are not app users but are part of the family record.
Columns: id, first_name, father_name, grandfather_name, full_name, birth_year, death_year,
gender, parent_id (self-reference), notes, created_by, created_at.

### secure_vault
Personal secure document storage per user. Biometric-locked on the device.
Columns: id, user_id, title, category (will/deed/heritage/private), storage_path,
is_encrypted, unlock_at (optional future unlock date), created_at.

### bug_reports
In-app bug and issue reporting by members.
Columns: id, user_id, title, description, status (open/in_review/resolved/closed),
created_at.

2. Security
- archive_items: all can read; admin/chairman/manager can write.
- family_tree_extras: all can read; admin/chairman can write.
- secure_vault: strictly own-only access (no other user can read another's vault).
- bug_reports: members can INSERT own and SELECT own; admins see all.
*/

-- archive_items
CREATE TABLE IF NOT EXISTS public.archive_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  section       text NOT NULL DEFAULT 'family'
                  CHECK (section IN ('family','meetings','events','trips')),
  media_type    text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  storage_path  text NOT NULL,
  thumbnail_url text,
  pinned        boolean NOT NULL DEFAULT false,
  expires_at    timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_archive_items" ON public.archive_items;
CREATE POLICY "auth_select_archive_items" ON public.archive_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_archive_items" ON public.archive_items;
CREATE POLICY "manager_insert_archive_items" ON public.archive_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_update_archive_items" ON public.archive_items;
CREATE POLICY "manager_update_archive_items" ON public.archive_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_archive_items" ON public.archive_items;
CREATE POLICY "manager_delete_archive_items" ON public.archive_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- family_tree_extras
CREATE TABLE IF NOT EXISTS public.family_tree_extras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      text NOT NULL,
  father_name     text,
  grandfather_name text,
  full_name       text,
  birth_year      integer,
  death_year      integer,
  gender          text DEFAULT 'male' CHECK (gender IN ('male','female')),
  parent_id       uuid REFERENCES public.family_tree_extras(id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.family_tree_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_family_tree_extras" ON public.family_tree_extras;
CREATE POLICY "auth_select_family_tree_extras" ON public.family_tree_extras FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_family_tree_extras" ON public.family_tree_extras;
CREATE POLICY "admin_insert_family_tree_extras" ON public.family_tree_extras FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_update_family_tree_extras" ON public.family_tree_extras;
CREATE POLICY "admin_update_family_tree_extras" ON public.family_tree_extras FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_family_tree_extras" ON public.family_tree_extras;
CREATE POLICY "admin_delete_family_tree_extras" ON public.family_tree_extras FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- secure_vault
CREATE TABLE IF NOT EXISTS public.secure_vault (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  category     text NOT NULL DEFAULT 'private'
                 CHECK (category IN ('will','deed','heritage','private')),
  storage_path text,
  is_encrypted boolean NOT NULL DEFAULT true,
  unlock_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.secure_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_vault" ON public.secure_vault;
CREATE POLICY "own_select_vault" ON public.secure_vault FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_insert_vault" ON public.secure_vault;
CREATE POLICY "own_insert_vault" ON public.secure_vault FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_vault" ON public.secure_vault;
CREATE POLICY "own_update_vault" ON public.secure_vault FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_vault" ON public.secure_vault;
CREATE POLICY "own_delete_vault" ON public.secure_vault FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- bug_reports
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_review','resolved','closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_bug_reports" ON public.bug_reports;
CREATE POLICY "own_select_bug_reports" ON public.bug_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "own_insert_bug_reports" ON public.bug_reports;
CREATE POLICY "own_insert_bug_reports" ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_bug_reports" ON public.bug_reports;
CREATE POLICY "admin_update_bug_reports" ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_bug_reports" ON public.bug_reports;
CREATE POLICY "admin_delete_bug_reports" ON public.bug_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

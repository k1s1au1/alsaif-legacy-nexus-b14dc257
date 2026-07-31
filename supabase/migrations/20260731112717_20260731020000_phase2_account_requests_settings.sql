/*
# Phase 2: Account Requests, App Settings, Section Heads

1. New Tables

### account_requests
Stores pending membership applications submitted by prospective members or on behalf
of existing members. Admins and the chairman can review and approve/reject requests.
Columns: id, full_name, arabic_name, phone, email, notes, status (pending/approved/rejected),
reviewed_by, reviewed_at, created_at.

### app_settings
Global key/value configuration pairs for the app (logo URL, news ticker text, etc.).
All authenticated users can read; only admins/chairman can write.
Columns: key (PK), value, updated_at.

### section_heads
Maps a user to a section they are responsible for managing (meetings, trips, finance, etc.).
Used to grant section-specific management access without granting full admin.
Columns: id, user_id, section, created_at.

2. Security
- RLS enabled on all tables.
- account_requests: public INSERT (anyone can apply); admin/chairman for SELECT/UPDATE/DELETE.
- app_settings: all authenticated can SELECT; admin/chairman for INSERT/UPDATE/DELETE.
- section_heads: all authenticated can SELECT; admin/chairman for INSERT/UPDATE/DELETE.
*/

-- account_requests
CREATE TABLE IF NOT EXISTS public.account_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  arabic_name   text,
  phone         text,
  email         text,
  notes         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_account_requests" ON public.account_requests;
CREATE POLICY "public_insert_account_requests"
  ON public.account_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_select_account_requests" ON public.account_requests;
CREATE POLICY "admin_select_account_requests"
  ON public.account_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_update_account_requests" ON public.account_requests;
CREATE POLICY "admin_update_account_requests"
  ON public.account_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_account_requests" ON public.account_requests;
CREATE POLICY "admin_delete_account_requests"
  ON public.account_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all_select_app_settings" ON public.app_settings;
CREATE POLICY "all_select_app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_app_settings" ON public.app_settings;
CREATE POLICY "admin_insert_app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_update_app_settings" ON public.app_settings;
CREATE POLICY "admin_update_app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_app_settings" ON public.app_settings;
CREATE POLICY "admin_delete_app_settings"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- section_heads
CREATE TABLE IF NOT EXISTS public.section_heads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);

ALTER TABLE public.section_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all_select_section_heads" ON public.section_heads;
CREATE POLICY "all_select_section_heads"
  ON public.section_heads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_section_heads" ON public.section_heads;
CREATE POLICY "admin_insert_section_heads"
  ON public.section_heads FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_update_section_heads" ON public.section_heads;
CREATE POLICY "admin_update_section_heads"
  ON public.section_heads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "admin_delete_section_heads" ON public.section_heads;
CREATE POLICY "admin_delete_section_heads"
  ON public.section_heads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

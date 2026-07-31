/*
# Phase 8: Notifications, Push Tokens, Steps Challenge & Anonymous Suggestions

1. New Tables

### push_tokens
Stores FCM/device push notification tokens per user per device.
Columns: id, user_id, token (unique), platform (android/ios/web), created_at, updated_at.

### notification_preferences
Per-user toggle preferences for different notification categories.
Columns: id, user_id, chat (bool), meetings (bool), news (bool), tasks (bool),
entertainment (bool), created_at, updated_at.

### steps_data
Daily step counts per user for the weekly steps challenge leaderboard.
Columns: id, user_id, date, steps, created_at.
Unique constraint on (user_id, date) to allow upsert.

### anonymous_suggestions
Fully anonymous suggestion box — no user_id stored.
Anyone (authenticated or anon key) can INSERT; only admins and the chairman can read.
Columns: id, content, status (pending/reviewed/archived), created_at.

2. Security notes
- push_tokens: users own their own tokens; service_role used for push delivery.
- notification_preferences: strictly own-only.
- steps_data: any authenticated user can read all (leaderboard); own INSERT/UPDATE.
- anonymous_suggestions: open INSERT; admin/chairman SELECT/UPDATE/DELETE only.
*/

-- push_tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios','web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_push_tokens" ON public.push_tokens;
CREATE POLICY "own_select_push_tokens" ON public.push_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_insert_push_tokens" ON public.push_tokens;
CREATE POLICY "own_insert_push_tokens" ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_push_tokens" ON public.push_tokens;
CREATE POLICY "own_update_push_tokens" ON public.push_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_push_tokens" ON public.push_tokens;
CREATE POLICY "own_delete_push_tokens" ON public.push_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat          boolean NOT NULL DEFAULT true,
  meetings      boolean NOT NULL DEFAULT true,
  news          boolean NOT NULL DEFAULT true,
  tasks         boolean NOT NULL DEFAULT true,
  entertainment boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_notif_prefs" ON public.notification_preferences;
CREATE POLICY "own_select_notif_prefs" ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_insert_notif_prefs" ON public.notification_preferences;
CREATE POLICY "own_insert_notif_prefs" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_notif_prefs" ON public.notification_preferences;
CREATE POLICY "own_update_notif_prefs" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_notif_prefs" ON public.notification_preferences;
CREATE POLICY "own_delete_notif_prefs" ON public.notification_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- steps_data
CREATE TABLE IF NOT EXISTS public.steps_data (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  steps      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.steps_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_steps_data" ON public.steps_data;
CREATE POLICY "auth_select_steps_data" ON public.steps_data FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_steps_data" ON public.steps_data;
CREATE POLICY "own_insert_steps_data" ON public.steps_data FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_steps_data" ON public.steps_data;
CREATE POLICY "own_update_steps_data" ON public.steps_data FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_steps_data" ON public.steps_data;
CREATE POLICY "own_delete_steps_data" ON public.steps_data FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- anonymous_suggestions
CREATE TABLE IF NOT EXISTS public.anonymous_suggestions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content    text NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anonymous_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_suggestions" ON public.anonymous_suggestions;
CREATE POLICY "anon_insert_suggestions" ON public.anonymous_suggestions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "management_select_suggestions" ON public.anonymous_suggestions;
CREATE POLICY "management_select_suggestions" ON public.anonymous_suggestions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "management_update_suggestions" ON public.anonymous_suggestions;
CREATE POLICY "management_update_suggestions" ON public.anonymous_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "management_delete_suggestions" ON public.anonymous_suggestions;
CREATE POLICY "management_delete_suggestions" ON public.anonymous_suggestions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

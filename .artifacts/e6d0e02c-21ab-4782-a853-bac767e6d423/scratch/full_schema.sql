
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  arabic_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin activity log
CREATE TABLE public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "All members view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "All members view roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin log policies (admins read; writes happen via service role)
CREATE POLICY "Admins read activity log"
  ON public.admin_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, arabic_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'arabic_name'
  )
  ON CONFLICT (id) DO NOTHING;

  -- If this is the very first user in the system, promote them to admin.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pin search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke public exec on all SECURITY DEFINER helpers.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- has_role is intentionally callable from RLS policies as the signed-in user.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read all messages" ON public.messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members send own messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins delete messages" ON public.messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX messages_created_at_idx ON public.messages (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ============================================================
-- Multi-room chat: public + private rooms with per-room members
-- ============================================================

-- 1) Room role enum
DO $$ BEGIN
  CREATE TYPE public.room_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) chat_rooms
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- 3) chat_room_members
CREATE TABLE public.chat_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_role public.room_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_room_members TO authenticated;
GRANT ALL ON public.chat_room_members TO service_role;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_room_members_user ON public.chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_room ON public.chat_room_members(room_id);

-- 4) Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_room_member(_user uuid, _room uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE user_id = _user AND room_id = _room
  )
$$;

CREATE OR REPLACE FUNCTION public.is_room_admin(_user uuid, _room uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.chat_room_members
      WHERE user_id = _user
        AND room_id = _room
        AND room_role IN ('owner', 'admin')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_room_public(_room uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms WHERE id = _room AND is_private = false
  )
$$;

-- 5) updated_at trigger for chat_rooms
CREATE TRIGGER touch_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) Auto-add creator as owner when a room is created
CREATE OR REPLACE FUNCTION public.add_room_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.chat_room_members (room_id, user_id, room_role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_rooms_add_owner
  AFTER INSERT ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.add_room_owner();

-- 7) RLS on chat_rooms
CREATE POLICY "View public rooms or rooms you belong to"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (
    is_private = false
    OR public.is_room_member(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins create rooms"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Room admins update rooms"
  ON public.chat_rooms FOR UPDATE
  TO authenticated
  USING (public.is_room_admin(auth.uid(), id))
  WITH CHECK (public.is_room_admin(auth.uid(), id));

CREATE POLICY "Room admins delete rooms"
  ON public.chat_rooms FOR DELETE
  TO authenticated
  USING (public.is_room_admin(auth.uid(), id));

-- 8) RLS on chat_room_members
CREATE POLICY "View members of visible rooms"
  ON public.chat_room_members FOR SELECT
  TO authenticated
  USING (
    public.is_room_public(room_id)
    OR public.is_room_member(auth.uid(), room_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Room admins add members"
  ON public.chat_room_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_room_admin(auth.uid(), room_id));

CREATE POLICY "Room admins update members"
  ON public.chat_room_members FOR UPDATE
  TO authenticated
  USING (public.is_room_admin(auth.uid(), room_id))
  WITH CHECK (public.is_room_admin(auth.uid(), room_id));

CREATE POLICY "Room admins remove members"
  ON public.chat_room_members FOR DELETE
  TO authenticated
  USING (
    public.is_room_admin(auth.uid(), room_id)
    OR user_id = auth.uid()  -- members can leave
  );

-- 9) Seed default public room "ظ…ط¬ظ„ط³ ط§ظ„ط¹ط§ط¦ظ„ط©"
INSERT INTO public.chat_rooms (id, name, description, is_private, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'ظ…ط¬ظ„ط³ ط§ظ„ط¹ط§ط¦ظ„ط©',
  'ط§ظ„ظ‚ظ†ط§ط© ط§ظ„ط¹ط§ظ…ط© ظ„ط¬ظ…ظٹط¹ ط£ظپط±ط§ط¯ ط§ظ„ط¹ط§ط¦ظ„ط©',
  false,
  NULL
);

-- 10) Alter messages: add room_id, backfill, set NOT NULL
ALTER TABLE public.messages
  ADD COLUMN room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

UPDATE public.messages
  SET room_id = '00000000-0000-4000-8000-000000000001'
  WHERE room_id IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN room_id SET NOT NULL;

CREATE INDEX idx_messages_room ON public.messages(room_id, created_at DESC);

-- 11) Rewrite messages RLS for per-room visibility
DROP POLICY IF EXISTS "Members read all messages" ON public.messages;
DROP POLICY IF EXISTS "Members send own messages" ON public.messages;
DROP POLICY IF EXISTS "Admins delete messages" ON public.messages;

CREATE POLICY "View messages in visible rooms"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_room_public(room_id)
    OR public.is_room_member(auth.uid(), room_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Send messages to visible rooms"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_room_public(room_id)
      OR public.is_room_member(auth.uid(), room_id)
    )
  );

CREATE POLICY "Room admins delete messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (public.is_room_admin(auth.uid(), room_id));

-- 12) Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;
ALTER TABLE public.chat_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.chat_room_members REPLICA IDENTITY FULL;

-- =========================================================
-- 1) Drop the old chat system completely
-- =========================================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_room_members CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
DROP FUNCTION IF EXISTS public.is_room_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_room_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_room_public(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_room_owner() CASCADE;
DROP TYPE  IF EXISTS public.room_role CASCADE;

-- =========================================================
-- 2) Enums
-- =========================================================
CREATE TYPE public.conversation_kind AS ENUM ('direct', 'group');
CREATE TYPE public.conv_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.message_kind AS ENUM ('text', 'image', 'video', 'audio', 'file');
CREATE TYPE public.presence_status AS ENUM ('online', 'offline');

-- =========================================================
-- 3) conversations
-- =========================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.conversation_kind NOT NULL,
  title text,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);
CREATE TRIGGER touch_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4) conversation_participants
-- =========================================================
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.conv_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  UNIQUE (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cp_user ON public.conversation_participants(user_id);
CREATE INDEX idx_cp_conv ON public.conversation_participants(conversation_id);

-- =========================================================
-- 5) Helpers (SECURITY DEFINER to avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user uuid, _conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE user_id = _user AND conversation_id = _conv
  )
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(_user uuid, _conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE user_id = _user
      AND conversation_id = _conv
      AND role IN ('owner', 'admin')
  )
$$;

-- =========================================================
-- 6) messages
-- =========================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.message_kind NOT NULL DEFAULT 'text',
  body text,
  attachment_url text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  attachment_duration_ms integer,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

-- =========================================================
-- 7) message_reactions
-- =========================================================
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mr_message ON public.message_reactions(message_id);

-- =========================================================
-- 8) message_deliveries
-- =========================================================
CREATE TABLE public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_deliveries TO authenticated;
GRANT ALL ON public.message_deliveries TO service_role;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_md_user ON public.message_deliveries(user_id);
CREATE INDEX idx_md_message ON public.message_deliveries(message_id);

-- =========================================================
-- 9) user_presence
-- =========================================================
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.presence_status NOT NULL DEFAULT 'offline',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER touch_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 10) RLS policies
-- =========================================================

-- conversations
CREATE POLICY "Members view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), id));

CREATE POLICY "Users create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    (kind = 'direct' AND public.is_conversation_member(auth.uid(), id))
    OR (kind = 'group' AND public.is_conversation_admin(auth.uid(), id))
  )
  WITH CHECK (
    (kind = 'direct' AND public.is_conversation_member(auth.uid(), id))
    OR (kind = 'group' AND public.is_conversation_admin(auth.uid(), id))
  );

CREATE POLICY "Owners delete conversations"
  ON public.conversations FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_conversation_admin(auth.uid(), id));

-- conversation_participants
CREATE POLICY "View participants in your conversations"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Add participants (creator or admin)"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    -- The creator of a fresh conversation can seed initial participants
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
    OR public.is_conversation_admin(auth.uid(), conversation_id)
  );

CREATE POLICY "Self updates participant row, admin updates roles"
  ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_admin(auth.uid(), conversation_id))
  WITH CHECK (user_id = auth.uid() OR public.is_conversation_admin(auth.uid(), conversation_id));

CREATE POLICY "Self leaves or admin removes"
  ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_admin(auth.uid(), conversation_id));

-- messages
CREATE POLICY "Members view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(auth.uid(), conversation_id)
  );

CREATE POLICY "Senders edit own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Senders or admins delete messages"
  ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_conversation_admin(auth.uid(), conversation_id));

-- message_reactions
CREATE POLICY "Members view reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(auth.uid(), m.conversation_id)
    )
  );

CREATE POLICY "Members react"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(auth.uid(), m.conversation_id)
    )
  );

CREATE POLICY "Members remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- message_deliveries
CREATE POLICY "Recipient or sender views deliveries"
  ON public.message_deliveries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "Members create their delivery rows"
  ON public.message_deliveries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_member(auth.uid(), conversation_id)
  );

CREATE POLICY "Recipient marks delivered/read"
  ON public.message_deliveries FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_presence
CREATE POLICY "Anyone signed in views presence"
  ON public.user_presence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users upsert their own presence"
  ON public.user_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own presence"
  ON public.user_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================
-- 11) Triggers
-- =========================================================

-- Auto-seed the creator as owner when a conversation is created
CREATE OR REPLACE FUNCTION public.add_conversation_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, CASE WHEN NEW.kind = 'group' THEN 'owner'::conv_role ELSE 'member'::conv_role END)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_add_creator
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.add_conversation_creator();

-- After a message is inserted: bump conversation.last_message_at and fan-out delivery rows
CREATE OR REPLACE FUNCTION public.after_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  INSERT INTO public.message_deliveries (message_id, conversation_id, user_id, delivered_at)
  SELECT NEW.id, NEW.conversation_id, cp.user_id, NULL
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.after_message_insert();

-- =========================================================
-- 12) find_or_create_direct
-- =========================================================
CREATE OR REPLACE FUNCTION public.find_or_create_direct(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _other = v_me THEN
    RAISE EXCEPTION 'Cannot create a direct chat with yourself';
  END IF;

  -- Look for an existing direct conversation containing exactly these two
  SELECT c.id INTO v_conv
  FROM public.conversations c
  JOIN public.conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = v_me
  JOIN public.conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = _other
  WHERE c.kind = 'direct'
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    RETURN v_conv;
  END IF;

  INSERT INTO public.conversations (kind, created_by)
  VALUES ('direct', v_me)
  RETURNING id INTO v_conv;

  -- Trigger seeds v_me; add the other side
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (v_conv, _other, 'member')
  ON CONFLICT DO NOTHING;

  RETURN v_conv;
END;
$$;

-- =========================================================
-- 13) Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_deliveries REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Storage RLS for chat-attachments bucket
-- File path layout: {conversation_id}/{message_id}/{filename}

CREATE POLICY "Members read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(
      auth.uid(),
      (string_to_array(name, '/'))[1]::uuid
    )
  );

CREATE POLICY "Members upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(
      auth.uid(),
      (string_to_array(name, '/'))[1]::uuid
    )
  );

CREATE POLICY "Owners or admins delete chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      owner = auth.uid()
      OR public.is_conversation_admin(
        auth.uid(),
        (string_to_array(name, '/'))[1]::uuid
      )
    )
  );
CREATE OR REPLACE FUNCTION public.whoami() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated, anon;
DROP POLICY IF EXISTS "Members view their conversations" ON public.conversations;
CREATE POLICY "Members view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_conversation_member(auth.uid(), id));

DROP FUNCTION IF EXISTS public.whoami();

-- Group send permissions
CREATE TYPE public.group_send_permission AS ENUM ('all', 'admins', 'selected');

ALTER TABLE public.conversations
  ADD COLUMN send_permission public.group_send_permission NOT NULL DEFAULT 'all';

ALTER TABLE public.conversation_participants
  ADD COLUMN can_send boolean NOT NULL DEFAULT true;

-- Helper: can the user send in this conversation?
CREATE OR REPLACE FUNCTION public.can_user_send(_user uuid, _conv uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_conversation_member(_user, _conv) THEN false
    WHEN (SELECT kind FROM public.conversations WHERE id = _conv) = 'direct' THEN true
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'all' THEN true
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'admins'
      THEN public.is_conversation_admin(_user, _conv)
    WHEN (SELECT send_permission FROM public.conversations WHERE id = _conv) = 'selected'
      THEN public.is_conversation_admin(_user, _conv) OR EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = _conv AND user_id = _user AND can_send = true
      )
    ELSE false
  END;
$$;

-- Replace messages INSERT policy to enforce send permission
DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_user_send(auth.uid(), conversation_id)
  );

CREATE POLICY "Avatars are viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_read_at timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_member(v_user_id, _conversation_id) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = v_read_at
  WHERE conversation_id = _conversation_id
    AND user_id = v_user_id;

  UPDATE public.message_deliveries
  SET
    delivered_at = COALESCE(delivered_at, v_read_at),
    read_at = v_read_at
  WHERE conversation_id = _conversation_id
    AND user_id = v_user_id
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  badge text,
  location text,
  start_date date,
  end_date date,
  description text,
  image_url text,
  status text NOT NULL DEFAULT 'upcoming',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view trips" ON public.trips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create trips" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators or admins can update trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creators or admins can delete trips" ON public.trips
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trips_touch_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.trips ADD COLUMN location_url text;
CREATE POLICY "Authenticated can view trip images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'trip-images');

CREATE POLICY "Authenticated can upload trip images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-images');

CREATE POLICY "Authenticated can update own trip images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'trip-images' AND owner = auth.uid());

CREATE POLICY "Authenticated can delete own trip images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'trip-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "Authenticated can create trips" ON public.trips;
DROP POLICY IF EXISTS "Creators or admins can update trips" ON public.trips;
DROP POLICY IF EXISTS "Creators or admins can delete trips" ON public.trips;

CREATE POLICY "Admins or managers can create trips"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

CREATE POLICY "Admins or managers can update trips"
  ON public.trips FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE POLICY "Admins or managers can delete trips"
  ON public.trips FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );
CREATE TABLE public.trip_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.trip_attendees TO authenticated;
GRANT ALL ON public.trip_attendees TO service_role;

ALTER TABLE public.trip_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendees"
  ON public.trip_attendees FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users confirm own attendance"
  ON public.trip_attendees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own attendance"
  ON public.trip_attendees FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX trip_attendees_trip_id_idx ON public.trip_attendees(trip_id);
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS grandfather_name text;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TYPE public.fund_tx_type AS ENUM ('contribution', 'expense');

CREATE TABLE public.fund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.fund_tx_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_transactions TO authenticated;
GRANT ALL ON public.fund_transactions TO service_role;

ALTER TABLE public.fund_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transactions"
  ON public.fund_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/managers can insert"
  ON public.fund_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins/managers can update"
  ON public.fund_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins/managers can delete"
  ON public.fund_transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_fund_transactions_updated_at
  BEFORE UPDATE ON public.fund_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.fund_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_transactions;

-- Duplicate guard: reject identical tx from same user within 5 seconds
CREATE OR REPLACE FUNCTION public.prevent_duplicate_fund_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fund_transactions
    WHERE created_by = NEW.created_by
      AND type = NEW.type
      AND amount = NEW.amount
      AND COALESCE(description,'') = COALESCE(NEW.description,'')
      AND created_at > now() - interval '5 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate transaction detected, please wait a few seconds';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_fund_tx_trigger ON public.fund_transactions;
CREATE TRIGGER prevent_duplicate_fund_tx_trigger
BEFORE INSERT ON public.fund_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_fund_tx();

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.bank_transfer_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  sender_name TEXT NOT NULL,
  reference_number TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_url TEXT,
  note TEXT,
  status public.bank_transfer_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  fund_transaction_id UUID REFERENCES public.fund_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate prevention: same reference number cannot exist twice
CREATE UNIQUE INDEX IF NOT EXISTS bank_transfers_reference_unique
  ON public.bank_transfers (reference_number)
  WHERE reference_number IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS bank_transfers_status_idx ON public.bank_transfers(status);
CREATE INDEX IF NOT EXISTS bank_transfers_submitted_by_idx ON public.bank_transfers(submitted_by);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.bank_transfers TO authenticated;
GRANT ALL ON public.bank_transfers TO service_role;

-- RLS
ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own transfers"
  ON public.bank_transfers FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Members create own transfers"
  ON public.bank_transfers FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "Admins update transfers"
  ON public.bank_transfers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- updated_at trigger
CREATE TRIGGER bank_transfers_set_updated_at
  BEFORE UPDATE ON public.bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On approval: auto-create matching fund_transactions row and link it
CREATE OR REPLACE FUNCTION public.bank_transfer_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_desc TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.fund_transaction_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    v_desc := 'طھط­ظˆظٹظ„ ط¨ظ†ظƒظٹ ظ…ظ† ' || NEW.sender_name ||
              CASE WHEN NEW.reference_number IS NOT NULL
                   THEN ' (ظ…ط±ط¬ط¹: ' || NEW.reference_number || ')'
                   ELSE '' END;

    INSERT INTO public.fund_transactions (type, amount, description, occurred_at, created_by)
    VALUES ('contribution', NEW.amount, v_desc, NEW.transferred_at, NEW.submitted_by)
    RETURNING id INTO v_tx_id;

    NEW.fund_transaction_id := v_tx_id;
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  -- On revert from approved â†’ remove linked fund transaction
  IF OLD.status = 'approved' AND NEW.status <> 'approved' AND OLD.fund_transaction_id IS NOT NULL THEN
    DELETE FROM public.fund_transactions WHERE id = OLD.fund_transaction_id;
    NEW.fund_transaction_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_transfer_on_approve_trigger ON public.bank_transfers;
CREATE TRIGGER bank_transfer_on_approve_trigger
  BEFORE UPDATE ON public.bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.bank_transfer_on_approve();

-- Realtime
ALTER TABLE public.bank_transfers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transfers;

-- 1) Restrict Realtime subscriptions to conversation members
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can subscribe to their conversation topics" ON realtime.messages;
CREATE POLICY "Members can subscribe to their conversation topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow when topic is a conversation UUID and the user is a member,
  -- or when the topic is not a conversation channel (non-uuid topics).
  CASE
    WHEN realtime.topic() ~ '^[0-9a-fA-F-]{36}$'
      THEN public.is_conversation_member(auth.uid(), realtime.topic()::uuid)
    ELSE false
  END
);

-- 2) Restrict trip-images uploads to admins/managers
DROP POLICY IF EXISTS "Authenticated can upload trip images" ON storage.objects;
CREATE POLICY "Admins and managers can upload trip images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS "Authenticated can update trip images" ON storage.objects;
CREATE POLICY "Admins and managers can update trip images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

-- Enum for RSVP status
DO $$ BEGIN
  CREATE TYPE public.meeting_rsvp AS ENUM ('going','not_going','maybe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  location_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view meetings"
  ON public.meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can create meetings"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins and managers can update meetings"
  ON public.meetings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins and managers can delete meetings"
  ON public.meetings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER meetings_set_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- attendees table
CREATE TABLE public.meeting_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rsvp public.meeting_rsvp NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendees TO authenticated;
GRANT ALL ON public.meeting_attendees TO service_role;

ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendees"
  ON public.meeting_attendees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can RSVP for themselves"
  ON public.meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can update their own RSVP"
  ON public.meeting_attendees FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can remove their own RSVP; admins any"
  ON public.meeting_attendees FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
  );

CREATE TRIGGER meeting_attendees_set_updated_at
  BEFORE UPDATE ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendees;
-- Archive items table for family photos/videos
CREATE TYPE public.archive_media_type AS ENUM ('image', 'video');

CREATE TABLE public.archive_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type public.archive_media_type NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_items TO authenticated;
GRANT ALL ON public.archive_items TO service_role;

ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view archive"
  ON public.archive_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members can upload archive items"
  ON public.archive_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Owners or admins can update archive items"
  ON public.archive_items FOR UPDATE TO authenticated
  USING (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Owners or admins can delete archive items"
  ON public.archive_items FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Enforce expiry cap of 60 days from creation, even if pinned is toggled off
CREATE OR REPLACE FUNCTION public.archive_enforce_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.created_at + INTERVAL '60 days' THEN
    NEW.expires_at := NEW.created_at + INTERVAL '60 days';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER archive_items_enforce_expiry
  BEFORE INSERT OR UPDATE ON public.archive_items
  FOR EACH ROW EXECUTE FUNCTION public.archive_enforce_expiry();

-- Storage bucket policies (bucket created via tool separately)
CREATE POLICY "Authenticated can view archive media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archive-media');

CREATE POLICY "Authenticated can upload archive media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners or admins can delete archive media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'archive-media' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Scheduled cleanup: delete expired non-pinned items daily at 03:00
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.archive_cleanup_expired()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.archive_items
  WHERE pinned = false AND expires_at <= now();
END;
$$;

SELECT cron.schedule(
  'archive-cleanup-expired-daily',
  '0 3 * * *',
  $$SELECT public.archive_cleanup_expired();$$
);

-- Section enum
DO $$ BEGIN
  CREATE TYPE public.archive_section AS ENUM ('family','meetings','events','trips');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add column (default family for back-compat)
ALTER TABLE public.archive_items
  ADD COLUMN IF NOT EXISTS section public.archive_section NOT NULL DEFAULT 'family';

-- Allow expires_at to be null (non-family items don't expire)
ALTER TABLE public.archive_items ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.archive_items ALTER COLUMN expires_at DROP DEFAULT;

-- Replace expiry trigger: family => 3 days max; others => null
CREATE OR REPLACE FUNCTION public.archive_enforce_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.section = 'family' THEN
    IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.created_at + INTERVAL '3 days' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '3 days';
    END IF;
  ELSE
    NEW.expires_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Cleanup respects null expiry
CREATE OR REPLACE FUNCTION public.archive_cleanup_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.archive_items
  WHERE pinned = false
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

-- Refresh existing rows so they conform (they're all "family" by default)
UPDATE public.archive_items
SET expires_at = LEAST(COALESCE(expires_at, created_at + INTERVAL '3 days'), created_at + INTERVAL '3 days')
WHERE section = 'family';

-- Update RLS policies
DROP POLICY IF EXISTS "Members can upload archive items" ON public.archive_items;
DROP POLICY IF EXISTS "Owners or admins can update archive items" ON public.archive_items;
DROP POLICY IF EXISTS "Owners or admins can delete archive items" ON public.archive_items;

CREATE POLICY "Insert archive items by section rules"
ON public.archive_items
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploader_id
  AND (
    section = 'family'
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
  )
);

CREATE POLICY "Update archive items by section rules"
ON public.archive_items
FOR UPDATE TO authenticated
USING (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
)
WITH CHECK (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
);

CREATE POLICY "Delete archive items by section rules"
ON public.archive_items
FOR DELETE TO authenticated
USING (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
);

DO $$ BEGIN
  CREATE TYPE public.account_request_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  grandfather_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  note TEXT,
  status public.account_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_requests TO authenticated;
GRANT INSERT ON public.account_requests TO anon;
GRANT ALL ON public.account_requests TO service_role;

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit account requests"
ON public.account_requests
FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

CREATE POLICY "Admins and managers can view account requests"
ON public.account_requests
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins and managers can update account requests"
ON public.account_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins and managers can delete account requests"
ON public.account_requests
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER account_requests_touch
BEFORE UPDATE ON public.account_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS desired_password TEXT;
DELETE FROM public.account_requests WHERE email IS NULL;
ALTER TABLE public.account_requests ALTER COLUMN email SET NOT NULL;

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

CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated members can view all tasks (family-wide visibility)
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

-- Admins, managers can create tasks; or any member can create their own
CREATE POLICY "Members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creator, assignee, admin, or manager can update
CREATE POLICY "Authorized users can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = assignee_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Creator, admin, manager can delete
CREATE POLICY "Authorized users can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

CREATE TYPE public.event_type AS ENUM ('wedding','birthday','graduation','religious','social','other');
CREATE TYPE public.event_status AS ENUM ('scheduled','cancelled','completed');
CREATE TYPE public.event_rsvp AS ENUM ('going','not_going','maybe');

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type public.event_type NOT NULL DEFAULT 'social',
  location text,
  location_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status public.event_status NOT NULL DEFAULT 'scheduled',
  cover_image_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/managers can insert events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins/managers can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins/managers can delete events" ON public.events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rsvp public.event_rsvp NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendees TO authenticated;
GRANT ALL ON public.event_attendees TO service_role;

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendees" ON public.event_attendees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage own rsvp insert" ON public.event_attendees
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members manage own rsvp update" ON public.event_attendees
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members manage own rsvp delete" ON public.event_attendees
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_event_attendees_updated_at
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX events_starts_at_idx ON public.events(starts_at);
CREATE INDEX event_attendees_event_id_idx ON public.event_attendees(event_id);

-- Add parent linkage for family tree
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_parent_id_idx ON public.profiles(parent_id);

-- Auto-link parent on insert/update by matching names:
-- A profile's parent is another profile whose first_name == this.father_name
-- AND father_name == this.grandfather_name.
CREATE OR REPLACE FUNCTION public.profiles_auto_link_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent uuid;
BEGIN
  -- Only auto-fill when parent is not already set
  IF NEW.parent_id IS NULL AND NEW.father_name IS NOT NULL THEN
    SELECT p.id INTO v_parent
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND p.first_name IS NOT NULL
      AND btrim(p.first_name) = btrim(NEW.father_name)
      AND (
        NEW.grandfather_name IS NULL
        OR p.father_name IS NULL
        OR btrim(p.father_name) = btrim(NEW.grandfather_name)
      )
    ORDER BY (CASE WHEN p.father_name IS NOT NULL
                   AND btrim(p.father_name) = btrim(COALESCE(NEW.grandfather_name,''))
                   THEN 0 ELSE 1 END)
    LIMIT 1;

    NEW.parent_id := v_parent;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_auto_link_parent_trg ON public.profiles;
CREATE TRIGGER profiles_auto_link_parent_trg
BEFORE INSERT OR UPDATE OF first_name, father_name, grandfather_name
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_auto_link_parent();

-- Backfill existing rows
UPDATE public.profiles me
SET parent_id = parent.id
FROM public.profiles parent
WHERE me.parent_id IS NULL
  AND me.father_name IS NOT NULL
  AND parent.id <> me.id
  AND parent.first_name IS NOT NULL
  AND btrim(parent.first_name) = btrim(me.father_name)
  AND (
    me.grandfather_name IS NULL
    OR parent.father_name IS NULL
    OR btrim(parent.father_name) = btrim(me.grandfather_name)
  );

ALTER TYPE public.majlis_post_kind ADD VALUE IF NOT EXISTS 'complaint';

DROP POLICY IF EXISTS "Authenticated can read posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Admins/managers can insert posts" ON public.majlis_posts;

CREATE POLICY "Read posts (complaints restricted)"
ON public.majlis_posts FOR SELECT
TO authenticated
USING (
  kind <> 'complaint'
  OR author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Insert posts by kind"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    kind = 'complaint'
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS "Authenticated can read comments" ON public.majlis_comments;
CREATE POLICY "Read comments (complaints restricted)"
ON public.majlis_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.majlis_posts p
    WHERE p.id = majlis_comments.post_id
      AND (
        p.kind <> 'complaint'
        OR p.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
      )
  )
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS desired_password TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS desired_password TEXT;
-- App-wide settings (key/value) for things like background image URLs
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. login page) can read settings
CREATE POLICY "anyone can read settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins/managers can write
CREATE POLICY "admins manage settings insert"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "admins manage settings update"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "admins manage settings delete"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER app_settings_touch_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Storage policies for app-backgrounds bucket
CREATE POLICY "anyone can read app-backgrounds"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'app-backgrounds');

CREATE POLICY "admins upload app-backgrounds"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "admins update app-backgrounds"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "admins delete app-backgrounds"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app-backgrounds'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Fix foreign key constraint in fund_transactions
-- The original constraint was ON DELETE SET NULL on a NOT NULL column, which blocks deletion.
-- We'll change it to ON DELETE CASCADE to ensure the user can be deleted.

ALTER TABLE public.fund_transactions
DROP CONSTRAINT IF EXISTS fund_transactions_created_by_fkey;

ALTER TABLE public.fund_transactions
ADD CONSTRAINT fund_transactions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Also add missing constraints for other tables to ensure clean deletion
-- and avoid any potential default "RESTRICT" behavior if they were added later.

-- meeting_attendees
ALTER TABLE public.meeting_attendees
DROP CONSTRAINT IF EXISTS meeting_attendees_user_id_fkey;

ALTER TABLE public.meeting_attendees
ADD CONSTRAINT meeting_attendees_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- event_attendees
ALTER TABLE public.event_attendees
DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;

ALTER TABLE public.event_attendees
ADD CONSTRAINT event_attendees_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure meetings can be deleted even if creator is gone
ALTER TABLE public.meetings
DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;

ALTER TABLE public.meetings
ADD CONSTRAINT meetings_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fund_transactions
DROP CONSTRAINT IF EXISTS fund_transactions_created_by_fkey;

ALTER TABLE public.fund_transactions
ADD CONSTRAINT fund_transactions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Allow profiles.parent_id to point to either a profile or a tree-only member
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_parent_id_fkey;

-- Tree-only members (no auth account)
CREATE TABLE IF NOT EXISTS public.family_tree_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  father_name text,
  grandfather_name text,
  parent_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_tree_extras TO authenticated;
GRANT ALL ON public.family_tree_extras TO service_role;

ALTER TABLE public.family_tree_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All members view extras" ON public.family_tree_extras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers manage extras" ON public.family_tree_extras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER family_tree_extras_touch_updated_at
  BEFORE UPDATE ON public.family_tree_extras
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Add status column to trip_attendees
ALTER TABLE public.trip_attendees ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('going', 'not_going')) DEFAULT 'going';

-- Set existing records to 'going'
UPDATE public.trip_attendees SET status = 'going' WHERE status IS NULL;
-- Allow users to update their own attendance status
CREATE POLICY "Users update own attendance status"
  ON public.trip_attendees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chairman';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_meetings';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_events';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_trips';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_finance';

DROP POLICY IF EXISTS "Members can update their own participant row" ON public.conversation_participants;
DROP POLICY IF EXISTS "participants_self_update" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can update self" ON public.conversation_participants;

CREATE POLICY "Participants self-update non-privileged"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND can_send IS NOT DISTINCT FROM (
    SELECT cp.can_send FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
  )
  AND role IS NOT DISTINCT FROM (
    SELECT cp.role FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Conversation admins manage participants"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (public.is_conversation_admin(auth.uid(), conversation_id))
WITH CHECK (public.is_conversation_admin(auth.uid(), conversation_id));

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_chairman_unique ON public.user_roles ((role)) WHERE role = 'chairman';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_meetings_unique ON public.user_roles ((role)) WHERE role = 'head_meetings';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_events_unique ON public.user_roles ((role)) WHERE role = 'head_events';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_trips_unique ON public.user_roles ((role)) WHERE role = 'head_trips';
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_head_finance_unique ON public.user_roles ((role)) WHERE role = 'head_finance';

-- Helper to check management privilege per section
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user
      AND role IN (
        'admin'::app_role,
        'manager'::app_role,
        'chairman'::app_role,
        CASE _section
          WHEN 'meetings' THEN 'head_meetings'::app_role
          WHEN 'events' THEN 'head_events'::app_role
          WHEN 'trips' THEN 'head_trips'::app_role
          WHEN 'finance' THEN 'head_finance'::app_role
          ELSE 'admin'::app_role
        END
      )
  )
$$;

-- MEETINGS
DROP POLICY IF EXISTS "Admins and managers can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Admins and managers can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Admins and managers can delete meetings" ON public.meetings;
CREATE POLICY "Meeting managers can insert" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_section(auth.uid(),'meetings'));
CREATE POLICY "Meeting managers can update" ON public.meetings
  FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'meetings'));
CREATE POLICY "Meeting managers can delete" ON public.meetings
  FOR DELETE TO authenticated USING (public.can_manage_section(auth.uid(),'meetings'));

-- TRIPS
DROP POLICY IF EXISTS "Admins or managers can create trips" ON public.trips;
DROP POLICY IF EXISTS "Admins or managers can update trips" ON public.trips;
DROP POLICY IF EXISTS "Admins or managers can delete trips" ON public.trips;
CREATE POLICY "Trip managers can insert" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_section(auth.uid(),'trips'));
CREATE POLICY "Trip managers can update" ON public.trips
  FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'trips'));
CREATE POLICY "Trip managers can delete" ON public.trips
  FOR DELETE TO authenticated USING (public.can_manage_section(auth.uid(),'trips'));

-- EVENTS
DROP POLICY IF EXISTS "Admins/managers can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins/managers can update events" ON public.events;
DROP POLICY IF EXISTS "Admins/managers can delete events" ON public.events;
CREATE POLICY "Event managers can insert" ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_section(auth.uid(),'events'));
CREATE POLICY "Event managers can update" ON public.events
  FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'events'));
CREATE POLICY "Event managers can delete" ON public.events
  FOR DELETE TO authenticated USING (public.can_manage_section(auth.uid(),'events'));

-- FUND TRANSACTIONS
DROP POLICY IF EXISTS "Admins/managers can insert" ON public.fund_transactions;
DROP POLICY IF EXISTS "Admins/managers can update" ON public.fund_transactions;
DROP POLICY IF EXISTS "Admins/managers can delete" ON public.fund_transactions;
CREATE POLICY "Finance managers can insert" ON public.fund_transactions
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_section(auth.uid(),'finance'));
CREATE POLICY "Finance managers can update" ON public.fund_transactions
  FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'finance'));
CREATE POLICY "Finance managers can delete" ON public.fund_transactions
  FOR DELETE TO authenticated USING (public.can_manage_section(auth.uid(),'finance'));

-- BANK TRANSFERS
DROP POLICY IF EXISTS "Admins update transfers" ON public.bank_transfers;
CREATE POLICY "Finance managers update transfers" ON public.bank_transfers
  FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'finance'));

DROP POLICY IF EXISTS "Members view own transfers" ON public.bank_transfers;
CREATE POLICY "Members and finance view transfers" ON public.bank_transfers
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.can_manage_section(auth.uid(),'finance'));

-- MEETING ATTENDEES delete (managers can remove any)
DROP POLICY IF EXISTS "Members can remove their own RSVP; admins any" ON public.meeting_attendees;
CREATE POLICY "Members remove own RSVP or meeting managers any" ON public.meeting_attendees
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_section(auth.uid(),'meetings'));
-- Add head_heritage role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_heritage';
create table if not exists public.user_fcm_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  device_type text,
  created_at timestamp with time zone default now() not null,
  unique(user_id, token)
);

alter table public.user_fcm_tokens enable row level security;

create policy "Users can manage their own tokens"
  on public.user_fcm_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fix RLS for majlis_posts to empower Chairman and fix member posting
DROP POLICY IF EXISTS "Read posts (complaints restricted)" ON public.majlis_posts;
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;

-- SELECT: All can read everything except complaints (which are private to author and priv roles)
CREATE POLICY "Majlis Select Policy"
ON public.majlis_posts FOR SELECT
TO authenticated
USING (
  kind <> 'complaint'
  OR author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- INSERT: Members can post discussions/complaints. Priv roles can post anything (announcements).
CREATE POLICY "Majlis Insert Policy"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (kind IN ('discussion', 'complaint') AND pinned = false)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- UPDATE: Author or priv roles
CREATE POLICY "Majlis Update Policy"
ON public.majlis_posts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- DELETE: Author or priv roles
CREATE POLICY "Majlis Delete Policy"
ON public.majlis_posts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- Fix Comments too
DROP POLICY IF EXISTS "Read comments (complaints restricted)" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can update comments" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can delete comments" ON public.majlis_comments;

CREATE POLICY "Majlis Comments Select Policy"
ON public.majlis_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.majlis_posts p
    WHERE p.id = majlis_comments.post_id
      AND (
        p.kind <> 'complaint'
        OR p.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
        OR public.has_role(auth.uid(), 'chairman')
      )
  )
);

CREATE POLICY "Majlis Comments Update Policy"
ON public.majlis_comments FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

CREATE POLICY "Majlis Comments Delete Policy"
ON public.majlis_comments FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'chairman')
);

-- Update storage policies for 'trip-images' to empower Chairman and allow members to upload (for bugs/complaints)
DROP POLICY IF EXISTS "Admins and managers can upload trip images" ON storage.objects;
DROP POLICY IF EXISTS "Admins and managers can update trip images" ON storage.objects;

CREATE POLICY "Authorized upload trip images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR (auth.uid() IS NOT NULL) -- Allow all members to upload images (for bugs/news)
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Authorized update trip images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR owner = auth.uid()
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Authorized delete trip images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
    OR owner = auth.uid()
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'app-backgrounds'
DROP POLICY IF EXISTS "admins upload app-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "admins update app-backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "admins delete app-backgrounds" ON storage.objects;

CREATE POLICY "Priv roles upload app-backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Priv roles update app-backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

CREATE POLICY "Priv roles delete app-backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-backgrounds'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Update storage policies for 'archive-media'
DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;

CREATE POLICY "Priv roles delete archive media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'archive-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  )
);

-- Souq Alsaif - Family Business Directory
CREATE TABLE public.family_businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  whatsapp_number TEXT,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_businesses TO authenticated;
GRANT ALL ON public.family_businesses TO service_role;

ALTER TABLE public.family_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view businesses"
  ON public.family_businesses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage their businesses"
  ON public.family_businesses FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Priv roles can manage all businesses"
  ON public.family_businesses FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'chairman')
  );

CREATE TRIGGER family_businesses_touch BEFORE UPDATE ON public.family_businesses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TABLE IF EXISTS public.family_businesses CASCADE;

-- Final robust solution: Use the existing majlis_posts table with a special title prefix for trip items
-- This bypasses all schema cache issues because majlis_posts is already well-cached.

-- Ensure RLS on majlis_posts is ready for this (it should be already from previous fixes)
-- We don't need to change the schema, just use it.
NOTIFY pgrst, 'reload schema';

-- Allow chairman to insert/update/delete majlis posts and upload images
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;
CREATE POLICY "Insert posts by kind" ON public.majlis_posts
  FOR INSERT WITH CHECK (
    (author_id = auth.uid()) AND (
      kind = 'complaint'::majlis_post_kind
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;
CREATE POLICY "Author or admin/manager can update posts" ON public.majlis_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  );

DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;
CREATE POLICY "Author or admin/manager can delete posts" ON public.majlis_posts
  FOR DELETE USING (
    author_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  );

-- Storage: allow chairman to upload trip images and app backgrounds
DROP POLICY IF EXISTS "Admins and managers can upload trip images" ON storage.objects;
CREATE POLICY "Admins and managers can upload trip images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update trip images" ON storage.objects;
CREATE POLICY "Admins and managers can update trip images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  ) WITH CHECK (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete trip images" ON storage.objects;
CREATE POLICY "Admins and managers can delete trip images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trip-images' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins upload app-backgrounds" ON storage.objects;
CREATE POLICY "admins upload app-backgrounds" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins update app-backgrounds" ON storage.objects;
CREATE POLICY "admins update app-backgrounds" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

DROP POLICY IF EXISTS "admins delete app-backgrounds" ON storage.objects;
CREATE POLICY "admins delete app-backgrounds" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'app-backgrounds' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'chairman'::app_role)
    )
  );

-- Allow any authenticated member to publish discussion-kind posts (sharing/event/discussion in UI),
-- and keep announcement restricted to chairman/admin/manager. Complaints remain open to authors.
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;

CREATE POLICY "Insert posts by kind"
ON public.majlis_posts
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    kind = 'complaint'::majlis_post_kind
    OR kind = 'discussion'::majlis_post_kind
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'chairman'::app_role)
  )
);

-- Allow section heads (events) to also publish announcements/events through the news page if needed
-- Extend events INSERT/UPDATE/DELETE to include chairman fallback already handled by can_manage_section.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token text;
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user
      AND role IN (
        'admin'::app_role,
        'manager'::app_role,
        'chairman'::app_role,
        CASE _section
          WHEN 'meetings' THEN 'head_meetings'::app_role
          WHEN 'events' THEN 'head_events'::app_role
          WHEN 'trips' THEN 'head_trips'::app_role
          WHEN 'finance' THEN 'head_finance'::app_role
          WHEN 'heritage' THEN 'head_heritage'::app_role
          ELSE 'admin'::app_role
        END
      )
  )
$function$;

-- 1) New section_heads table
CREATE TABLE public.section_heads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('meetings','events','trips','finance','heritage','majlis')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);

GRANT SELECT ON public.section_heads TO authenticated;
GRANT ALL ON public.section_heads TO service_role;

ALTER TABLE public.section_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view section heads"
  ON public.section_heads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins/chairman manage section heads"
  ON public.section_heads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- 2) Migrate existing head_* roles into section_heads
INSERT INTO public.section_heads (user_id, section)
SELECT user_id,
  CASE role::text
    WHEN 'head_meetings' THEN 'meetings'
    WHEN 'head_events' THEN 'events'
    WHEN 'head_trips' THEN 'trips'
    WHEN 'head_finance' THEN 'finance'
    WHEN 'head_heritage' THEN 'heritage'
  END
FROM public.user_roles
WHERE role::text LIKE 'head_%'
ON CONFLICT DO NOTHING;

-- 3) Remove head_* rows from user_roles (enum values remain for safety; code stops using them)
DELETE FROM public.user_roles WHERE role::text LIKE 'head_%';

-- 4) Replace can_manage_section to read from section_heads
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

-- 5) Security fix: drop overlapping permissive UPDATE policy on conversation_participants
DROP POLICY IF EXISTS "Self updates participant row, admin updates roles" ON public.conversation_participants;

-- ============= Security fix: majlis_posts =============
DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;

CREATE POLICY "Author or admin/manager can delete posts"
ON public.majlis_posts
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Author or admin/manager can update posts"
ON public.majlis_posts
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

-- ============= Family projects =============
DO $$ BEGIN
  CREATE TYPE public.family_project_status AS ENUM ('pending','approved','rejected','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.family_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  goal_amount numeric(12,2) NOT NULL CHECK (goal_amount > 0),
  fund_allocation numeric(12,2) NOT NULL DEFAULT 0 CHECK (fund_allocation >= 0),
  fund_transaction_id uuid REFERENCES public.fund_transactions(id) ON DELETE SET NULL,
  status public.family_project_status NOT NULL DEFAULT 'pending',
  proposed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_projects TO authenticated;
GRANT ALL ON public.family_projects TO service_role;

ALTER TABLE public.family_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects"
ON public.family_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can propose projects"
ON public.family_projects FOR INSERT TO authenticated
WITH CHECK (
  proposed_by = auth.uid()
  AND status = 'pending'
  AND fund_allocation = 0
);

CREATE POLICY "Proposer can delete pending or admins anytime"
ON public.family_projects FOR DELETE TO authenticated
USING (
  (proposed_by = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Chairman/admin can update projects"
ON public.family_projects FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE TRIGGER trg_family_projects_updated
BEFORE UPDATE ON public.family_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Contributions =============
CREATE TABLE IF NOT EXISTS public.family_project_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.family_projects(id) ON DELETE CASCADE,
  contributor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.family_project_contributions TO authenticated;
GRANT ALL ON public.family_project_contributions TO service_role;

ALTER TABLE public.family_project_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contributions"
ON public.family_project_contributions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can add their own contributions to approved projects"
ON public.family_project_contributions FOR INSERT TO authenticated
WITH CHECK (
  contributor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.family_projects p
    WHERE p.id = project_id AND p.status = 'approved'
  )
);

CREATE POLICY "Owner or admin can delete contribution"
ON public.family_project_contributions FOR DELETE TO authenticated
USING (
  contributor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_family_project_contrib_project
  ON public.family_project_contributions(project_id);
DROP POLICY IF EXISTS "Only admins/chairman manage section heads" ON public.section_heads;
CREATE POLICY "Only chairman manages section heads"
ON public.section_heads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'chairman'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'chairman'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.meeting_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slides','file','link')),
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_path TEXT,
  external_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_presentations TO authenticated;
GRANT ALL ON public.meeting_presentations TO service_role;

ALTER TABLE public.meeting_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view presentations"
  ON public.meeting_presentations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Meeting managers can insert"
  ON public.meeting_presentations FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_section(auth.uid(), 'meetings'));

CREATE POLICY "Meeting managers can update"
  ON public.meeting_presentations FOR UPDATE
  TO authenticated
  USING (public.can_manage_section(auth.uid(), 'meetings'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'meetings'));

CREATE POLICY "Meeting managers can delete"
  ON public.meeting_presentations FOR DELETE
  TO authenticated
  USING (public.can_manage_section(auth.uid(), 'meetings'));

CREATE TRIGGER trg_meeting_presentations_updated
BEFORE UPDATE ON public.meeting_presentations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_meeting_presentations_meeting ON public.meeting_presentations(meeting_id);

CREATE POLICY "view meeting presentation files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-presentations');

CREATE POLICY "manage meeting presentation files - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

CREATE POLICY "manage meeting presentation files - update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

CREATE POLICY "manage meeting presentation files - delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meeting-presentations'
  AND public.can_manage_section(auth.uid(), 'meetings')
);

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

CREATE POLICY "community-media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'community-media');
CREATE POLICY "community-media insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "community-media delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE TABLE public.trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_items TO authenticated;
GRANT ALL ON public.trip_items TO service_role;

ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view trip items"
ON public.trip_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Trip managers can manage trip items"
ON public.trip_items FOR ALL
TO authenticated
USING (public.can_manage_section(auth.uid(), 'trips'))
WITH CHECK (public.can_manage_section(auth.uid(), 'trips'));

CREATE POLICY "Members can claim or release trip items"
ON public.trip_items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (auth.uid() = assigned_to OR assigned_to IS NULL);

CREATE TRIGGER update_trip_items_updated_at
BEFORE UPDATE ON public.trip_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing trip checklist items from majlis_posts
INSERT INTO public.trip_items (trip_id, name, assigned_to, created_by, created_at, updated_at)
SELECT
  (regexp_match(title, '^\[TRIP-ITEM:([^\]]+)\]'))[1]::uuid AS trip_id,
  trim(regexp_replace(title, '^\[TRIP-ITEM:[^\]]+\]\s*', '')) AS name,
  CASE
    WHEN body LIKE 'ASSIGNED:%'
    THEN split_part(substring(body from '^ASSIGNED:([^\n]+)'), E'\n', 1)::uuid
    ELSE NULL
  END AS assigned_to,
  author_id AS created_by,
  created_at,
  COALESCE(updated_at, created_at) AS updated_at
FROM public.majlis_posts
WHERE kind = 'discussion' AND title LIKE '[TRIP-ITEM:%]';

-- Delete migrated rows from majlis_posts
DELETE FROM public.majlis_posts
WHERE kind = 'discussion' AND title LIKE '[TRIP-ITEM:%]';

NOTIFY pgrst, 'reload schema';

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can create their own bug reports"
  ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reporter can view their own bug reports"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "admins and chairman can view all bug reports"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

CREATE POLICY "admins and chairman can update bug reports"
  ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

CREATE POLICY "admins and chairman can delete bug reports"
  ON public.bug_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

CREATE TRIGGER bug_reports_touch_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 1. profiles: restrict phone & fcm_token from broad SELECT via column grants
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, arabic_name, avatar_url, is_active,
  created_at, updated_at, first_name, father_name,
  grandfather_name, parent_id, terms_accepted_at
) ON public.profiles TO authenticated;

-- Owner self-read (includes sensitive cols) via security definer
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Phone access for owner / admin / chairman
CREATE OR REPLACE FUNCTION public.get_member_phone(_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT phone FROM public.profiles
  WHERE id = _user
    AND (
      auth.uid() = _user
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'chairman'::app_role)
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_member_phone(uuid) TO authenticated;

-- FCM token count helper (admin/chairman only)
CREATE OR REPLACE FUNCTION public.count_fcm_tokens()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'chairman'::app_role)
    THEN (
      SELECT COUNT(*)::int FROM public.profiles
      WHERE fcm_token IS NOT NULL AND length(fcm_token) > 10
    )
    ELSE 0
  END;
$$;
GRANT EXECUTE ON FUNCTION public.count_fcm_tokens() TO authenticated;

-- 2. user_roles: drop manager-escalation policy
DROP POLICY IF EXISTS "Managers manage non-admin roles" ON public.user_roles;

-- 3. can_manage_section: require section_heads match for managers (not blanket)
CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user, 'admin'::app_role)
    OR public.has_role(_user, 'chairman'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.section_heads
      WHERE user_id = _user AND section = _section
    );
$$;

-- 4. trip_items: remove USING(true) on UPDATE
DROP POLICY IF EXISTS "Members can claim or release trip items" ON public.trip_items;
CREATE POLICY "Members can claim or release trip items"
ON public.trip_items
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK ((auth.uid() = assigned_to) OR (assigned_to IS NULL));

-- 1) push_tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web','android','ios')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens(user_id) WHERE is_active;

CREATE TRIGGER push_tokens_touch
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  meetings boolean NOT NULL DEFAULT true,
  entertainment boolean NOT NULL DEFAULT true,
  tasks boolean NOT NULL DEFAULT true,
  chat boolean NOT NULL DEFAULT true,
  news boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own prefs"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_prefs_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.secure_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  storage_path TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  unlock_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.secure_vault TO authenticated;
GRANT ALL ON public.secure_vault TO service_role;

ALTER TABLE public.secure_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their vault items"
  ON public.secure_vault FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their vault items"
  ON public.secure_vault FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their vault items"
  ON public.secure_vault FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their vault items"
  ON public.secure_vault FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX idx_secure_vault_owner ON public.secure_vault(owner_id);

-- Storage policies for vault-media bucket (files stored under <owner_id>/...)
CREATE POLICY "Vault owners can read their files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can upload their files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can update their files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can delete their files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at) ON public.profiles TO authenticated;
-- Owners still get phone/fcm_token via get_my_profile() and get_member_phone() SECURITY DEFINER functions.
ALTER TABLE public.meeting_attendees ADD COLUMN companions_count INTEGER DEFAULT 0;
ALTER TABLE public.event_attendees ADD COLUMN companions_count INTEGER DEFAULT 0;

-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: call send-push edge function
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _exclude uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
BEGIN
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object('title', _title, 'body', _body, 'url', _url, 'exclude_user_id', _exclude)
  );
END;
$$;

-- Meetings notification
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯',
    COALESCE(NEW.title,'طھظ… ط¥ط¶ط§ظپط© ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯'),
    '/meetings',
    NEW.created_by
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- Trips notification
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط±ط­ظ„ط© ط¬ط¯ظٹط¯ط©',
    COALESCE(NEW.title,'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text,
    NEW.created_by
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- Chat message notification: notify participants of the conversation, exclude sender
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  SELECT COALESCE(full_name, arabic_name, 'ط±ط³ط§ظ„ط© ط¬ط¯ظٹط¯ط©') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND COALESCE(muted,false) = false;

  IF v_recipients IS NULL OR array_length(v_recipients,1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := CASE WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body,''), 100) ELSE 'ًں“ژ ظ…ط±ظپظ‚' END;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object(
      'title', COALESCE(v_sender_name,'ط±ط³ط§ظ„ط© ط¬ط¯ظٹط¯ط©'),
      'body', v_preview,
      'url', '/chat/'||NEW.conversation_id::text,
      'user_ids', to_jsonb(v_recipients),
      'exclude_user_id', NEW.sender_id
    )
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 1. Redefine the helper with the CORRECT project URL and Key provided by the user
-- Project: zqllblksdyutspauafgi
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _exclude uuid DEFAULT NULL, _user_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('title', _title, 'body', _body, 'url', _url);

  IF _exclude IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('exclude_user_id', _exclude);
  END IF;

  IF _user_ids IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 2. Update Meetings Notification
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯',
    COALESCE(NEW.title,'طھظ… ط¥ط¶ط§ظپط© ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯'),
    '/meetings',
    NEW.created_by
  );
  RETURN NEW;
END; $$;

-- 3. Update Trips Notification
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط±ط­ظ„ط© ط¬ط¯ظٹط¯ط©',
    COALESCE(NEW.title,'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text,
    NEW.created_by
  );
  RETURN NEW;
END; $$;

-- 4. Create Tasks Notification (New)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Notify when a task is created with an assignee or when the assignee changes
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assignee_id IS NULL OR OLD.assignee_id <> NEW.assignee_id))) THEN
    -- Skip if the assignee is the one who did the action
    IF NEW.assignee_id <> auth.uid() THEN
      PERFORM public.call_send_push(
        'ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ظ…ظˆظƒظ„ط© ط¥ظ„ظٹظƒ',
        COALESCE(NEW.title, 'ظ„ط¯ظٹظƒ ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ط¥ظ†ط¬ط§ط²'),
        '/tasks',
        NULL,
        ARRAY[NEW.assignee_id]
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 5. Update Chat Notification (Fixing the call and ensuring recipients logic)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- Get sender name
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Get other participants who haven't muted the conversation
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND COALESCE(muted, false) = false;

  -- Only proceed if there are recipients
  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    v_preview := CASE
      WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 100)
      WHEN NEW.kind = 'image' THEN 'ًں“· طµظˆط±ط©'
      WHEN NEW.kind = 'video' THEN 'ًںژ¬ ظپظٹط¯ظٹظˆ'
      WHEN NEW.kind = 'audio' THEN 'ًںژ™ ط±ط³ط§ظ„ط© طµظˆطھظٹط©'
      ELSE 'ًں“ژ ظ…ط±ظپظ‚'
    END;

    -- Using the centralized helper with correct project URL
    PERFORM public.call_send_push(
      v_sender_name,
      v_preview,
      '/chat/' || NEW.conversation_id::text,
      NEW.sender_id,
      v_recipients
    );
  END IF;

  RETURN NEW;
END; $$;

-- Re-apply message trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 1. ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ط±ط¦ظٹط³ظٹ ظ„ظ„ط¥ط±ط³ط§ظ„ (طھط­ط¯ظٹط« ظ„ظ„ط±ط§ط¨ط· ظˆط§ظ„ظ…ظپط§طھظٹط­ ظˆط§ظ„ظ…ط³طھظ„ظ…ظٹظ†)
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _user_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  -- طھط¬ظ‡ظٹط² ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط£ط³ط§ط³ظٹط©
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- ط¥ط°ط§ ظƒط§ظ† ظ‡ظ†ط§ظƒ ظ…ط³طھط®ط¯ظ…ظٹظ† ظ…ط­ط¯ط¯ظٹظ† (ظ…ط«ظ„ ط§ظ„ظ…ظ‡ط§ظ… ط£ظˆ ط§ظ„ط¯ط±ط¯ط´ط©)
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  -- ط¥ط±ط³ط§ظ„ ط§ظ„ط·ظ„ط¨ ظپظˆط±ط§ظ‹
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := v_payload
  );
END;
$$;

-- 2. ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ…ظ‡ط§ظ… (ط¥ط±ط³ط§ظ„ ظپظˆط±ظٹ ط¹ظ†ط¯ ط§ظ„ط¥ط³ظ†ط§ط¯ ط£ظˆ ط§ظ„طھط؛ظٹظٹط±)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    -- ظ†ط±ط³ظ„ ط¥ط´ط¹ط§ط± ظ„ظ„ظ…ط³ط¤ظˆظ„ ط¹ظ† ط§ظ„ظ…ظ‡ظ…ط©
    PERFORM public.call_send_push(
      'ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ظ…ظˆظƒظ„ط© ط¥ظ„ظٹظƒ ًں“‹',
      COALESCE(NEW.title, 'ظ„ط¯ظٹظƒ ظ…ط³ط¤ظˆظ„ظٹط© ط¬ط¯ظٹط¯ط© ط¨ط§ظ†طھط¸ط§ط± ط¥ظ†ط¬ط§ط²ظƒ'),
      '/tasks',
      ARRAY[NEW.assignee_id]
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 3. ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط¯ط±ط¯ط´ط© (ط¥طµظ„ط§ط­ ظ…ظ†ط·ظ‚ ط§ظ„ظ…ط³طھظ„ظ…ظٹظ†)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط§ط³ظ… ط§ظ„ظ…ط±ط³ظ„
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ظƒط§ظپط© ط§ظ„ظ…ط´ط§ط±ظƒظٹظ† ظپظٹ ط§ظ„ظ…ط­ط§ط¯ط«ط© ظ…ط§ ط¹ط¯ط§ ط§ظ„ظ…ط±ط³ظ„
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  -- ط¥ط°ط§ ظ„ظ… ظٹظˆط¬ط¯ ظ…ط³طھظ„ظ…ظٹظ† ط¢ط®ط±ظٹظ† (ظ…ط«ظ„ ظ…ط­ط§ط¯ط«ط© ظ…ط¹ ط§ظ„ظ†ظپط³ ظ„ظ„طھط¬ط±ط¨ط©)طŒ ظ†ط±ط³ظ„ ظ„ظ„ظ…ط±ط³ظ„ ظ†ظپط³ظ‡ ظ„ظ„طھط£ظƒط¯ ظ…ظ† ط§ظ„ط¹ظ…ظ„
  IF v_recipients IS NULL OR array_length(v_recipients, 1) = 0 THEN
    v_recipients := ARRAY[NEW.sender_id];
  END IF;

  -- طھط¬ظ‡ظٹط² ظ†طµ ط§ظ„ظ…ط¹ط§ظٹظ†ط©
  v_preview := CASE
    WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50) || '...'
    WHEN NEW.kind = 'image' THEN 'ًں“· ط£ط±ط³ظ„ طµظˆط±ط©'
    WHEN NEW.kind = 'video' THEN 'ًںژ¬ ط£ط±ط³ظ„ ظپظٹط¯ظٹظˆ'
    WHEN NEW.kind = 'audio' THEN 'ًںژ™ ط±ط³ط§ظ„ط© طµظˆطھظٹط©'
    ELSE 'ًں“ژ ظ…ط±ظپظ‚ ط¬ط¯ظٹط¯'
  END;

  PERFORM public.call_send_push(
    v_sender_name,
    v_preview,
    '/chat/' || NEW.conversation_id::text,
    v_recipients
  );

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 1. طھط­ط¯ظٹط« ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ط±ط¦ظٹط³ظٹ ظ„ظٹط¯ط¹ظ… ط§ظ„طµظˆط±
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _user_ids uuid[] DEFAULT NULL, _image text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  IF _image IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 2. ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط±ط­ظ„ط§طھ ط¨طµظˆط± ط§ظ„ظˆط¬ظ‡ط©
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ظˆط¬ظ‡ط© طھط±ظپظٹظ‡ظٹط© ط¬ط¯ظٹط¯ط© ًںŒ´',
    COALESCE(NEW.title, 'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¹ط§ط¦ظ„ظٹط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text,
    NULL,
    NEW.image_url -- طھظ…ط±ظٹط± طµظˆط±ط© ط§ظ„ط±ط­ظ„ط©
  );
  RETURN NEW;
END; $$;

-- 3. ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط¯ط±ط¯ط´ط© ط¨طµظˆط± ط§ظ„ط£ط¹ط¶ط§ط،
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_sender_avatar text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- ط¬ظ„ط¨ ط§ط³ظ… ظˆطµظˆط±ط© ط§ظ„ظ…ط±ط³ظ„
  SELECT
    COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©'),
    avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  -- ط¬ظ„ط¨ ط§ظ„ظ…ط³طھظ„ظ…ظٹظ†
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  IF v_recipients IS NULL OR array_length(v_recipients, 1) = 0 THEN
    v_recipients := ARRAY[NEW.sender_id];
  END IF;

  v_preview := CASE
    WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
    WHEN NEW.kind = 'image' THEN 'ًں“· ط£ط±ط³ظ„ طµظˆط±ط©'
    WHEN NEW.kind = 'video' THEN 'ًںژ¬ ط£ط±ط³ظ„ ظپظٹط¯ظٹظˆ'
    WHEN NEW.kind = 'audio' THEN 'ًںژ™ ط±ط³ط§ظ„ط© طµظˆطھظٹط©'
    ELSE 'ًں“ژ ظ…ط±ظپظ‚ ط¬ط¯ظٹط¯'
  END;

  PERFORM public.call_send_push(
    v_sender_name,
    v_preview,
    '/chat/' || NEW.conversation_id::text,
    v_recipients,
    v_sender_avatar -- طھظ…ط±ظٹط± طµظˆط±ط© ط§ظ„ط¹ط¶ظˆ
  );

  RETURN NEW;
END; $$;

-- 1. Helper to resolve storage path to public URL (assuming public buckets for simplicity in notifications)
-- Project: zqllblksdyutspauafgi
CREATE OR REPLACE FUNCTION public.resolve_storage_url(_bucket text, _path text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF _path IS NULL OR _path = '' THEN RETURN NULL; END IF;
  -- If it's already a URL, return it
  IF _path LIKE 'http%' THEN RETURN _path; END IF;

  RETURN 'https://zqllblksdyutspauafgi.supabase.co/storage/v1/object/public/' || _bucket || '/' || _path;
END;
$$;

-- 2. Update Trips Notification with Public Image URL
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ظˆط¬ظ‡ط© طھط±ظپظٹظ‡ظٹط© ط¬ط¯ظٹط¯ط© ًںŒ´',
    COALESCE(NEW.title, 'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¹ط§ط¦ظ„ظٹط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text,
    NULL,
    public.resolve_storage_url('trip-images', NEW.image_url) -- Construct full public URL
  );
  RETURN NEW;
END; $$;

-- 3. Update Chat Notification with Public Avatar URL
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_sender_avatar text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- Get sender name and avatar path
  SELECT
    COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©'),
    avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Get recipients
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  IF v_recipients IS NULL OR array_length(v_recipients, 1) = 0 THEN
    v_recipients := ARRAY[NEW.sender_id];
  END IF;

  v_preview := CASE
    WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
    WHEN NEW.kind = 'image' THEN 'ًں“· ط£ط±ط³ظ„ طµظˆط±ط©'
    WHEN NEW.kind = 'video' THEN 'ًںژ¬ ط£ط±ط³ظ„ ظپظٹط¯ظٹظˆ'
    WHEN NEW.kind = 'audio' THEN 'ًںژ™ ط±ط³ط§ظ„ط© طµظˆطھظٹط©'
    ELSE 'ًں“ژ ظ…ط±ظپظ‚ ط¬ط¯ظٹط¯'
  END;

  PERFORM public.call_send_push(
    v_sender_name,
    v_preview,
    '/chat/' || NEW.conversation_id::text,
    v_recipients,
    public.resolve_storage_url('avatars', v_sender_avatar) -- Construct full public URL
  );

  RETURN NEW;
END; $$;

-- 1. ط¬ط¹ظ„ ظ…ط¬ظ„ط¯ط§طھ ط§ظ„طµظˆط± ط¹ط§ظ…ط© ظ„ط¶ظ…ط§ظ† طھط­ظ…ظٹظ„ظ‡ط§ ظپظٹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ
UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'trip-images');

-- 2. طھط­ط¯ظٹط« ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ط±ط¦ظٹط³ظٹ ظ„ط¶ظ…ط§ظ† طھط±طھظٹط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ (Title, Body, Url, UserIds, Image)
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _user_ids uuid[] DEFAULT NULL, _image text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- ط¥ط¶ط§ظپط© ط§ظ„طµظˆط±ط© ط¥ط°ط§ ظˆط¬ط¯طھ
  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  -- ط¥ط¶ط§ظپط© ط§ظ„ظ…ط³طھظ„ظ…ظٹظ† ط¥ط°ط§ ظˆط¬ط¯ظˆط§
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 3. ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ…ظ‡ط§ظ… (ط¥طµظ„ط§ط­ طھط±طھظٹط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ ظˆط¥ط¶ط§ظپط© طµظˆط±ط©)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_avatar text;
BEGIN
  -- ط¬ظ„ط¨ طµظˆط±ط© ط§ظ„ط´ط®طµ ط§ظ„ط°ظٹ ط£ط³ظ†ط¯ ط§ظ„ظ…ظ‡ظ…ط© ظ„ظƒظٹ طھط¸ظ‡ط± ظپظٹ ط§ظ„ط¥ط´ط¹ط§ط±
  SELECT avatar_url INTO v_creator_avatar FROM public.profiles WHERE id = NEW.created_by;

  IF NEW.assignee_id IS NOT NULL THEN
    PERFORM public.call_send_push(
      'ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ظ…ظˆظƒظ„ط© ط¥ظ„ظٹظƒ ًں“‹',
      COALESCE(NEW.title, 'ظ„ط¯ظٹظƒ ظ…ط³ط¤ظˆظ„ظٹط© ط¬ط¯ظٹط¯ط© ط¨ط§ظ†طھط¸ط§ط± ط¥ظ†ط¬ط§ط²ظƒ'),
      '/tasks',
      ARRAY[NEW.assignee_id], -- ط§ظ„ظ…ط³طھظ„ظ… (ط§ظ„ط±ط§ط¨ط¹)
      public.resolve_storage_url('avatars', v_creator_avatar) -- ط§ظ„طµظˆط±ط© (ط§ظ„ط®ط§ظ…ط³)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 4. ط¥ط¹ط§ط¯ط© طھط·ط¨ظٹظ‚ ظ…ط­ظپط²ط§طھ ط§ظ„ط¯ط±ط¯ط´ط© ظˆط§ظ„ط±ط­ظ„ط§طھ ظ„ط¶ظ…ط§ظ† ط§ط³طھط®ط¯ط§ظ… ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ط¬ط¯ظٹط¯
-- (ط³ظٹطھظ… ط§ط³طھط®ط¯ط§ظ… ط§ظ„ط¯ظˆط§ظ„ ط§ظ„طھظٹ طھظ… طھط¹ط±ظٹظپظ‡ط§ ط³ط§ط¨ظ‚ط§ظ‹ ظˆظ„ظƒظ†ظ‡ط§ ط³طھط¹ظ…ظ„ ط§ظ„ط¢ظ† ظ…ط¹ ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ظ…ط­ط¯ط«)

-- Restrict posting in Majlis (News) to only Chairman, admin, and news manager
-- 1) Update can_manage_section to be more precise if needed,
-- or just use a custom check in the policy.

-- 2) Update Majlis Insert Policy
DROP POLICY IF EXISTS "Majlis Insert Policy" ON public.majlis_posts;

CREATE POLICY "Majlis Insert Policy"
ON public.majlis_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'chairman')
    OR EXISTS (
      SELECT 1 FROM public.section_heads
      WHERE user_id = auth.uid() AND section = 'majlis'
    )
  )
);

-- 3) Update Majlis Update/Delete Policies to match
DROP POLICY IF EXISTS "Majlis Update Policy" ON public.majlis_posts;
CREATE POLICY "Majlis Update Policy"
ON public.majlis_posts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'chairman')
  OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = auth.uid() AND section = 'majlis'
  )
);

DROP POLICY IF EXISTS "Majlis Delete Policy" ON public.majlis_posts;
CREATE POLICY "Majlis Delete Policy"
ON public.majlis_posts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'chairman')
  OR EXISTS (
    SELECT 1 FROM public.section_heads
    WHERE user_id = auth.uid() AND section = 'majlis'
  )
);
CREATE OR REPLACE FUNCTION public.notify_task_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
  v_recipients uuid[];
BEGIN
  IF NEW.assignee_id IS NULL OR NEW.assignee_id = NEW.created_by THEN
    RETURN NEW;
  END IF;

  v_recipients := ARRAY[NEW.assignee_id];

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object(
      'title', 'ًں“‹ ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط©',
      'body', COALESCE(NEW.title, 'طھظ… ط¥ط³ظ†ط§ط¯ ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ط¥ظ„ظٹظƒ'),
      'url', '/tasks',
      'user_ids', to_jsonb(v_recipients),
      'exclude_user_id', NEW.created_by
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_task_created error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_created ON public.tasks;
CREATE TRIGGER trg_notify_task_created
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_created();

-- Fix RLS for account_requests to ensure Chairman can view and manage requests
DROP POLICY IF EXISTS "Admins and managers can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can delete account requests" ON public.account_requests;

-- Ensure these don't exist under the new names if this is re-run
DROP POLICY IF EXISTS "Privileged roles can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged roles can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged roles can delete account requests" ON public.account_requests;

CREATE POLICY "Privileged roles can view account requests"
ON public.account_requests
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Privileged roles can update account requests"
ON public.account_requests
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Privileged roles can delete account requests"
ON public.account_requests
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- 1. طھظ†ط¸ظٹظپ ظƒط§ظپط© ط§ظ„ظ†ط³ط® ط§ظ„ط³ط§ط¨ظ‚ط© ظ„ظ…ط­ط±ظƒ ط§ظ„ط¥ط±ط³ط§ظ„ ظ„طھظپط§ط¯ظٹ ط§ظ„طھظƒط±ط§ط± (Drop all overloads)
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid, uuid[]);
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.call_send_push(text, text, text, uuid[], text);

-- 2. ط¥ظ†ط´ط§ط، ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ظ…ظˆط­ط¯ ظˆط§ظ„ظ†ظ‡ط§ط¦ظٹ ظ„ظٹط¯ط¹ظ… ط§ظ„طھظپط§ط¹ظ„ (Interactivity) ظˆط§ظ„طµظˆط±
CREATE OR REPLACE FUNCTION public.call_send_push(
  _title text,
  _body text,
  _url text,
  _user_ids uuid[] DEFAULT NULL,
  _image text DEFAULT NULL,
  _category text DEFAULT NULL,
  _data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- ط¥ط¶ط§ظپط© ط§ظ„طµظˆط±ط© ط¥ط°ط§ ظˆط¬ط¯طھ
  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  -- ط¥ط¶ط§ظپط© ط§ظ„ظ…ط³طھظ„ظ…ظٹظ† ط¥ط°ط§ ظˆط¬ط¯ظˆط§
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  -- ط¥ط¶ط§ظپط© ط§ظ„طھطµظ†ظٹظپ (ظ„ظ„طھظپط§ط¹ظ„ ظ…ط«ظ„ MEETING_INVITE)
  IF _category IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('category', _category);
  END IF;

  -- ط¥ط¶ط§ظپط© ط¨ظٹط§ظ†ط§طھ ط¥ط¶ط§ظپظٹط© (ظ…ط«ظ„ meeting_id)
  IF _data IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('data', _data);
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 3. طھط­ط¯ظٹط« ط¥ط´ط¹ط§ط± ط§ظ„ط§ط¬طھظ…ط§ط¹ط§طھ ظ„ظٹط¯ط¹ظ… ط§ظ„طھظپط§ط¹ظ„ (ط³ط£ط­ط¶ط± / ط£ط¹طھط°ط±)
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط§ط¬طھظ…ط§ط¹ ط¹ط§ط¦ظ„ظٹ ط¬ط¯ظٹط¯ âœ¨',
    COALESCE(NEW.title, 'طھظ… ط¬ط¯ظˆظ„ط© ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯ ظ„ظ„ظ…ط¬ظ„ط³'),
    '/meetings',
    NULL, -- ظƒط§ظپط© ط§ظ„ط£ط¹ط¶ط§ط،
    NULL, -- ظ„ط§ طھظˆط¬ط¯ طµظˆط±ط© ط§ظپطھط±ط§ط¶ظٹط©
    'MEETING_INVITE', -- ط§ظ„طھطµظ†ظٹظپ ط§ظ„طھظپط§ط¹ظ„ظٹ
    jsonb_build_object('meeting_id', NEW.id) -- ط¨ظٹط§ظ†ط§طھ ط§ظ„ط±ط¨ط·
  );
  RETURN NEW;
END; $$;

-- ط§ظ„طھط£ظƒط¯ ظ…ظ† ظˆط¬ظˆط¯ ظ…ط­ظپط² ظˆط§ط­ط¯ ظپظ‚ط· ظ„ظ„ط§ط¬طھظ…ط§ط¹ط§طھ
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- 4. طھط­ط¯ظٹط« ط¥ط´ط¹ط§ط± ط§ظ„ط±ط­ظ„ط§طھ
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ظˆط¬ظ‡ط© طھط±ظپظٹظ‡ظٹط© ط¬ط¯ظٹط¯ط© ًںŒ´',
    COALESCE(NEW.title, 'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¹ط§ط¦ظ„ظٹط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text,
    NULL,
    NEW.image_url
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- 5. طھط­ط¯ظٹط« ط¥ط´ط¹ط§ط± ط§ظ„ظ…ظ‡ط§ظ…
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_avatar text;
BEGIN
  SELECT avatar_url INTO v_creator_avatar FROM public.profiles WHERE id = NEW.created_by;
  IF NEW.assignee_id IS NOT NULL THEN
    PERFORM public.call_send_push(
      'ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ظ…ظˆظƒظ„ط© ط¥ظ„ظٹظƒ ًں“‹',
      COALESCE(NEW.title, 'ظ„ط¯ظٹظƒ ظ…ط³ط¤ظˆظ„ظٹط© ط¬ط¯ظٹط¯ط© ط¨ط§ظ†طھط¸ط§ط± ط¥ظ†ط¬ط§ط²ظƒ'),
      '/tasks',
      ARRAY[NEW.assignee_id],
      v_creator_avatar
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 6. طھط­ط¯ظٹط« ط¥ط´ط¹ط§ط± ط§ظ„ط¯ط±ط¯ط´ط©
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_sender_avatar text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©'), avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    v_preview := CASE
      WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
      WHEN NEW.kind = 'image' THEN 'ًں“· ط£ط±ط³ظ„ طµظˆط±ط©'
      WHEN NEW.kind = 'video' THEN 'ًںژ¬ ط£ط±ط³ظ„ ظپظٹط¯ظٹظˆ'
      WHEN NEW.kind = 'audio' THEN 'ًںژ™ ط±ط³ط§ظ„ط© طµظˆطھظٹط©'
      ELSE 'ًں“ژ ظ…ط±ظپظ‚ ط¬ط¯ظٹط¯'
    END;

    PERFORM public.call_send_push(
      v_sender_name,
      v_preview,
      '/chat/' || NEW.conversation_id::text,
      v_recipients,
      v_sender_avatar
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 7. طھظ†ط¸ظٹظپ ط§ظ„ط±ظ…ظˆط² ط§ظ„ظ…ظƒط±ط±ط© ظ„ظ…ظ†ط¹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ…ط²ط¯ظˆط¬ط© (Prevent duplicates)
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.id < b.id
  AND a.token = b.token
  AND a.user_id = b.user_id;

-- 1. ط­ط°ظپ ظƒط§ظپط© ط§ظ„ظ…ط­ظپط²ط§طھ ط§ظ„ظ…ظƒط±ط±ط© ظˆط§ظ„ظ‚ط¯ظٹظ…ط© ظ…ظ† ظƒط§ظپط© ط§ظ„ط¬ط¯ط§ظˆظ„ ط°ط§طھ ط§ظ„طµظ„ط©
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS trg_notify_task_created ON public.tasks;
DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
DROP TRIGGER IF EXISTS messages_after_insert ON public.messages;

-- 2. طھظˆط­ظٹط¯ ط§ظ„ظ…ط­ط±ظƒ ط§ظ„ط±ط¦ظٹط³ظٹ ظ„ظٹط¯ط¹ظ… ط§ظ„طµظˆط± ظˆط§ظ„طھظپط§ط¹ظ„ ظˆط§ظ„ط±ظˆط§ط¨ط· ط§ظ„ط¹ظ…ظٹظ‚ط© (Deep Links)
CREATE OR REPLACE FUNCTION public.call_send_push(
  _title text,
  _body text,
  _url text,
  _user_ids uuid[] DEFAULT NULL,
  _image text DEFAULT NULL,
  _category text DEFAULT NULL,
  _data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  -- طھط¬ظ‡ظٹط² ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¥ط´ط¹ط§ط±
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  -- ط¥ط¶ط§ظپط© ط§ظ„طµظˆط±ط©
  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  -- ط¥ط¶ط§ظپط© ط§ظ„ظ…ط³طھظ„ظ…ظٹظ†
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  -- ط¥ط¶ط§ظپط© ط§ظ„طھطµظ†ظٹظپ (ظ„ظ„طھظپط§ط¹ظ„)
  IF _category IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('category', _category);
  END IF;

  -- ط¯ظ…ط¬ ط§ظ„ط±ط§ط¨ط· ظپظٹ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¥ط¶ط§ظپظٹط© ظ„ط¶ظ…ط§ظ† ظˆطµظˆظ„ظ‡ ظ„ظ„ظ€ Action Event ظپظٹ ط§ظ„طھط·ط¨ظٹظ‚
  v_payload := v_payload || jsonb_build_object('data',
    COALESCE(_data, '{}'::jsonb) || jsonb_build_object('url', _url)
  );

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 3. طھظپط¹ظٹظ„ ظ…ط­ظپط² ط§ظ„ط§ط¬طھظ…ط§ط¹ط§طھ ظ…ط¹ ط§ظ„طھظپط§ط¹ظ„ ظˆط§ظ„ط±ط¨ط· ط§ظ„ط¹ظ…ظٹظ‚
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ط§ط¬طھظ…ط§ط¹ ط¹ط§ط¦ظ„ظٹ ط¬ط¯ظٹط¯ âœ¨',
    COALESCE(NEW.title, 'طھظ… ط¬ط¯ظˆظ„ط© ط§ط¬طھظ…ط§ط¹ ط¬ط¯ظٹط¯ ظ„ظ„ظ…ط¬ظ„ط³'),
    '/meetings',
    NULL,
    NULL,
    'MEETING_INVITE',
    jsonb_build_object('meeting_id', NEW.id)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- 4. طھظپط¹ظٹظ„ ظ…ط­ظپط² ط§ظ„ط±ط­ظ„ط§طھ
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'ظˆط¬ظ‡ط© طھط±ظپظٹظ‡ظٹط© ط¬ط¯ظٹط¯ط© ًںŒ´',
    COALESCE(NEW.title, 'طھظ… ط¥ط¶ط§ظپط© ط±ط­ظ„ط© ط¹ط§ط¦ظ„ظٹط© ط¬ط¯ظٹط¯ط©'),
    '/trips/'||NEW.id::text
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_trip_created
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- 5. طھظپط¹ظٹظ„ ظ…ط­ظپط² ط§ظ„ظ…ظ‡ط§ظ…
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> auth.uid() THEN
    PERFORM public.call_send_push(
      'ظ…ظ‡ظ…ط© ط¬ط¯ظٹط¯ط© ظ…ظˆظƒظ„ط© ط¥ظ„ظٹظƒ ًں“‹',
      COALESCE(NEW.title, 'ظ„ط¯ظٹظƒ ظ…ط³ط¤ظˆظ„ظٹط© ط¬ط¯ظٹط¯ط© ط¨ط§ظ†طھط¸ط§ط± ط¥ظ†ط¬ط§ط²ظƒ'),
      '/tasks',
      ARRAY[NEW.assignee_id]
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 6. طھظپط¹ظٹظ„ ظ…ط­ظپط² ط§ظ„ط±ط³ط§ط¦ظ„ (ط§ظ„ط¯ط±ط¯ط´ط©)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    v_preview := CASE
      WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 50)
      WHEN NEW.kind = 'image' THEN 'ًں“· ط£ط±ط³ظ„ طµظˆط±ط©'
      ELSE 'ًں“ژ ظ…ط±ظپظ‚ ط¬ط¯ظٹط¯'
    END;

    PERFORM public.call_send_push(
      v_sender_name,
      v_preview,
      '/chat/' || NEW.conversation_id::text,
      v_recipients
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

-- 7. طھظ†ط¸ظٹظپ ط§ظ„ط±ظ…ظˆط² ط§ظ„ظ…ظƒط±ط±ط© ظ„ط¶ظ…ط§ظ† ط¹ط¯ظ… ط§ط³طھظ„ط§ظ… ط¥ط´ط¹ط§ط±ظٹظ† ظ„ظ†ظپط³ ط§ظ„ط¬ظ‡ط§ط²
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.id < b.id
  AND a.token = b.token
  AND a.user_id = b.user_id;
-- Keep legacy tokens working while allowing the current Android app to register its Firebase token.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.push_tokens
SET user_id = old_user_id::uuid
WHERE user_id IS NULL
  AND old_user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_id_token_key
  ON public.push_tokens (user_id, token)
  WHERE user_id IS NOT NULL;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_tokens'
      AND policyname = 'users manage current push tokens'
  ) THEN
    CREATE POLICY "users manage current push tokens"
      ON public.push_tokens
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $;

-- Ensure that each FCM token is associated with only one active record (the latest user)
-- This prevents a device from receiving duplicate notifications or notifications for multiple users.

-- 1. Remove any duplicate tokens before adding the constraint
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.id < b.id
  AND a.token = b.token;

-- 2. Add a unique constraint on the token column if it doesn't exist
-- First, drop any existing unique constraint on (user_id, token) that might interfere with a global token uniqueness
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

-- 3. Create a unique index on token
DROP INDEX IF EXISTS push_tokens_token_idx;
CREATE UNIQUE INDEX push_tokens_token_unique_idx ON public.push_tokens (token);

-- 4. Update the upsert logic in our heads
-- (The client code already uses { onConflict: 'token' })
ALTER TABLE public.meetings ADD COLUMN minutes TEXT;
CREATE TABLE public.steps_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  steps INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.steps_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all steps data" ON public.steps_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own steps data" ON public.steps_data FOR ALL TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON public.steps_data TO authenticated;
GRANT ALL ON public.steps_data TO service_role;
-- Allow each trip to define its own accommodation type.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS accommodation_type text NOT NULL DEFAULT 'ظ…ط®ظٹظ… ط¹ط§ط¦ظ„ظٹ ظپط§ط®ط±';

NOTIFY pgrst, 'reload schema';

-- 1. ط¥ط´ط¹ط§ط± ط¹ظ†ط¯ ط¥ط¶ط§ظپط© طµظˆط±/ظپظٹط¯ظٹظˆظ‡ط§طھ ط¬ط¯ظٹط¯ط© ظ„ظ„ط£ظ„ط¨ظˆظ… (ط§ظ„ط£ط±ط´ظٹظپ)
CREATE OR REPLACE FUNCTION public.notify_archive_item_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uploader_name text;
  v_section_name text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©') INTO v_uploader_name
  FROM public.profiles WHERE id = NEW.uploader_id;

  v_section_name := CASE
    WHEN NEW.section = 'family' THEN 'ط£ظ„ط¨ظˆظ… ط§ظ„ط¹ط§ط¦ظ„ط©'
    WHEN NEW.section = 'meetings' THEN 'ط§ط¬طھظ…ط§ط¹ط§طھظ†ط§'
    WHEN NEW.section = 'events' THEN 'ظپط¹ط§ظ„ظٹط§طھ ط§ظ„ط¹ط§ط¦ظ„ط©'
    WHEN NEW.section = 'trips' THEN 'ط±ط­ظ„ط§طھظ†ط§'
    ELSE 'ط§ظ„ط£ط±ط´ظٹظپ'
  END;

  PERFORM public.call_send_push(
    'ط°ظƒط±ظٹط§طھ ط¬ط¯ظٹط¯ط© ظپظٹ ' || v_section_name || ' âœ¨',
    v_uploader_name || ' ط£ط¶ط§ظپ طµظˆط±ط§ظ‹ ط¬ط¯ظٹط¯ط© ظ„ظ„ط£ظ„ط¨ظˆظ….. ط´ط§ظ‡ط¯ظ‡ط§ ط§ظ„ط¢ظ†!',
    '/archive',
    NULL, -- ط¥ط±ط³ط§ظ„ ظ„ظ„ط¬ظ…ظٹط¹
    NULL, -- ظٹظ…ظƒظ† طھط·ظˆظٹط±ظ‡ط§ ظ„ط¥ط±ط³ط§ظ„ طµظˆط±ط© ظ…طµط؛ط±ط© ط¥ط°ط§ ظƒط§ظ†طھ ظ…ط®ط²ظ†ط© ظپظٹ DB
    NULL,
    jsonb_build_object('section', NEW.section)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_archive_item_created ON public.archive_items;
CREATE TRIGGER trg_notify_archive_item_created
AFTER INSERT ON public.archive_items
FOR EACH ROW EXECUTE FUNCTION public.notify_archive_item_created();


-- 2. ط¥ط´ط¹ط§ط± ط¹ظ†ط¯ ط¥ط¶ط§ظپط© ط£ط®ط¨ط§ط± ط£ظˆ ط¥ط¹ظ„ط§ظ†ط§طھ ط¬ط¯ظٹط¯ط© ظپظٹ ط§ظ„ظ…ط¬ظ„ط³
CREATE OR REPLACE FUNCTION public.notify_majlis_post_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_name text;
  v_title text;
  v_label text;
BEGIN
  SELECT COALESCE(arabic_name, full_name, 'ط¹ط¶ظˆ ط§ظ„ط¹ط§ط¦ظ„ط©') INTO v_author_name
  FROM public.profiles WHERE id = NEW.author_id;

  v_label := CASE
    WHEN NEW.kind = 'announcement' THEN 'ط¥ط¹ظ„ط§ظ† ط±ط³ظ…ظٹ ًں“¢'
    ELSE 'ط®ط¨ط± ط¬ط¯ظٹط¯ ظپظٹ ط§ظ„ظ…ط¬ظ„ط³ ًں—‍ï¸ڈ'
  END;

  v_title := COALESCE(NEW.title, 'طھط­ط¯ظٹط« ط¬ط¯ظٹط¯');

  PERFORM public.call_send_push(
    v_label,
    v_title || ' - ظƒطھط¨ظ‡ ' || v_author_name,
    '/majlis'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_majlis_post_created ON public.majlis_posts;
CREATE TRIGGER trg_notify_majlis_post_created
AFTER INSERT ON public.majlis_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_majlis_post_created();

-- طھظ‡ظٹط¦ط© ظ…ط­ط±ظƒ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ظ„ظٹط¹ظ…ظ„ ط¹ظ„ظ‰ ظ…ط´ط±ظˆط¹ ظ…ظ†ظپطµظ„ (zqllblksdyutspauafgi)
-- ظ‡ط°ط§ ظٹط³ظ…ط­ ط¨ط¨ظ‚ط§ط، ط§ظ„ط¨ظٹط§ظ†ط§طھ ط¹ظ„ظ‰ ط§ظ„ظ…ط´ط±ظˆط¹ ط§ظ„ط£ظˆظ„ ظˆط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط¹ظ„ظ‰ ط§ظ„ط«ط§ظ†ظٹ

CREATE OR REPLACE FUNCTION public.call_send_push(
  _title text,
  _body text,
  _url text,
  _user_ids uuid[] DEFAULT NULL,
  _image text DEFAULT NULL,
  _category text DEFAULT NULL,
  _data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- طھظˆط¬ظٹظ‡ ط§ظ„ط·ظ„ط¨ ط­طµط±ط§ظ‹ ظ„ظ…ط­ط±ظƒ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ظپظٹ ط§ظ„ظ…ط´ط±ظˆط¹ ط§ظ„ط«ط§ظ†ظٹ
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  -- ظ…ظپطھط§ط­ ط§ظ„ظ€ Anon ط§ظ„ط®ط§طµ ط¨ظ…ط´ط±ظˆط¹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  -- طھط¬ظ‡ظٹط² ط§ظ„ط¨ظٹط§ظ†ط§طھ
  v_payload := jsonb_build_object(
    'title', _title,
    'body', _body,
    'url', _url
  );

  IF _image IS NOT NULL AND _image <> '' THEN
    v_payload := v_payload || jsonb_build_object('image', _image);
  END IF;

  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) > 0 THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  IF _category IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('category', _category);
  END IF;

  v_payload := v_payload || jsonb_build_object('data',
    COALESCE(_data, '{}'::jsonb) || jsonb_build_object('url', _url)
  );

  -- ط¥ط±ط³ط§ظ„ ط§ظ„ط·ظ„ط¨ ظ„ظ„ظ…ط´ط±ظˆط¹ ط§ظ„ط«ط§ظ†ظٹ
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

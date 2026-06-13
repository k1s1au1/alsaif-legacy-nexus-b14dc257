
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

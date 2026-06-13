
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

-- 9) Seed default public room "مجلس العائلة"
INSERT INTO public.chat_rooms (id, name, description, is_private, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'مجلس العائلة',
  'القناة العامة لجميع أفراد العائلة',
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

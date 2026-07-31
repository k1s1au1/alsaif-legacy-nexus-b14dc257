/*
# Phase 3: Meetings, Events, Tasks

1. New Tables

### meetings
Family council meetings with scheduling details.
Columns: id, title, description, scheduled_at, duration_minutes, location,
location_url, status (scheduled/in_progress/completed/cancelled), minutes (text), created_by, created_at.

### meeting_attendees
RSVP tracking per meeting per member.
Columns: id, meeting_id, user_id, status (going/not_going/maybe), created_at.

### meeting_presentations
Slide decks or files attached to meetings.
Columns: id, meeting_id, title, kind (slides/file/link), slides (jsonb),
file_path, external_url, created_by, created_at.

### events
Family events (weddings, birthdays, graduations, etc.).
Columns: id, title, description, event_type, starts_at, ends_at, location, status,
image_url, created_by, created_at.

### event_attendees
RSVP per event per member.
Columns: id, event_id, user_id, status, created_at.

### tasks
Task assignments with priority, status, and progress tracking.
Columns: id, title, description, assignee_id, created_by, priority (low/medium/high),
status (todo/in_progress/done), progress (0-100), due_date, created_at.

2. Security
- All tables: RLS enabled, authenticated users can SELECT, INSERT own rows, UPDATE/DELETE own rows.
- Admins/chairman/managers have broader write access.
*/

-- meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  location         text,
  location_url     text,
  status           text NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  minutes          text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_meetings" ON public.meetings;
CREATE POLICY "auth_select_meetings" ON public.meetings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_meetings" ON public.meetings;
CREATE POLICY "manager_insert_meetings" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_update_meetings" ON public.meetings;
CREATE POLICY "manager_update_meetings" ON public.meetings FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_delete_meetings" ON public.meetings;
CREATE POLICY "manager_delete_meetings" ON public.meetings FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

-- meeting_attendees
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'maybe' CHECK (status IN ('going','not_going','maybe')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "auth_select_meeting_attendees" ON public.meeting_attendees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "own_insert_meeting_attendees" ON public.meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "own_update_meeting_attendees" ON public.meeting_attendees FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_meeting_attendees" ON public.meeting_attendees;
CREATE POLICY "own_delete_meeting_attendees" ON public.meeting_attendees FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- meeting_presentations
CREATE TABLE IF NOT EXISTS public.meeting_presentations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title        text NOT NULL,
  kind         text NOT NULL DEFAULT 'slides' CHECK (kind IN ('slides','file','link')),
  slides       jsonb DEFAULT '[]'::jsonb,
  file_path    text,
  external_url text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_meeting_presentations" ON public.meeting_presentations;
CREATE POLICY "auth_select_meeting_presentations" ON public.meeting_presentations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_meeting_presentations" ON public.meeting_presentations;
CREATE POLICY "manager_insert_meeting_presentations" ON public.meeting_presentations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_update_meeting_presentations" ON public.meeting_presentations;
CREATE POLICY "manager_update_meeting_presentations" ON public.meeting_presentations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_meeting_presentations" ON public.meeting_presentations;
CREATE POLICY "manager_delete_meeting_presentations" ON public.meeting_presentations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- events
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  event_type  text NOT NULL DEFAULT 'social'
                CHECK (event_type IN ('wedding','birthday','graduation','religious','social','other')),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  location    text,
  status      text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  image_url   text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_events" ON public.events;
CREATE POLICY "auth_select_events" ON public.events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_events" ON public.events;
CREATE POLICY "manager_insert_events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_update_events" ON public.events;
CREATE POLICY "manager_update_events" ON public.events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_events" ON public.events;
CREATE POLICY "manager_delete_events" ON public.events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- event_attendees
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'going' CHECK (status IN ('going','not_going','maybe')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_event_attendees" ON public.event_attendees;
CREATE POLICY "auth_select_event_attendees" ON public.event_attendees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_event_attendees" ON public.event_attendees;
CREATE POLICY "own_insert_event_attendees" ON public.event_attendees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_event_attendees" ON public.event_attendees;
CREATE POLICY "own_update_event_attendees" ON public.event_attendees FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_event_attendees" ON public.event_attendees;
CREATE POLICY "own_delete_event_attendees" ON public.event_attendees FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  progress    integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_tasks" ON public.tasks;
CREATE POLICY "auth_select_tasks" ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_tasks" ON public.tasks;
CREATE POLICY "manager_insert_tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_update_tasks" ON public.tasks;
CREATE POLICY "manager_update_tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager') OR
    auth.uid() = assignee_id
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager') OR
    auth.uid() = assignee_id
  );

DROP POLICY IF EXISTS "manager_delete_tasks" ON public.tasks;
CREATE POLICY "manager_delete_tasks" ON public.tasks FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

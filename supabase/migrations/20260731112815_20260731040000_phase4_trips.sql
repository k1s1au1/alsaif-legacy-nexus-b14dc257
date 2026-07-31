/*
# Phase 4: Trips

1. New Tables

### trips
Family trip records including destination, dates, accommodation type, image, and badge.
Columns: id, title, description, start_date, end_date, location, location_url,
accommodation_type, status, badge, image_url, created_by, created_at.

### trip_attendees
Tracks who is attending a trip and their RSVP status.
Columns: id, trip_id, user_id, status (going/not_going/maybe), companions_count, created_at.

### trip_items
Packing / task list items for a trip, optionally assigned to a member.
Columns: id, trip_id, title, is_packed, assigned_to, created_by, created_at.

2. Security
- trips: all authenticated can read; admin/chairman/manager can write.
- trip_attendees: all can read; members manage their own row.
- trip_items: all can read; trip organizers and admins can write.
*/

-- trips
CREATE TABLE IF NOT EXISTS public.trips (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  description        text,
  start_date         date NOT NULL,
  end_date           date,
  location           text,
  location_url       text,
  accommodation_type text DEFAULT 'hotel'
                       CHECK (accommodation_type IN ('hotel','camping','chalet','resort','other')),
  status             text NOT NULL DEFAULT 'upcoming'
                       CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  badge              text,
  image_url          text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_trips" ON public.trips;
CREATE POLICY "auth_select_trips" ON public.trips FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_trips" ON public.trips;
CREATE POLICY "manager_insert_trips" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'chairman') OR
    public.has_role(auth.uid(), 'manager')
  );

DROP POLICY IF EXISTS "manager_update_trips" ON public.trips;
CREATE POLICY "manager_update_trips" ON public.trips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "manager_delete_trips" ON public.trips;
CREATE POLICY "manager_delete_trips" ON public.trips FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman') OR public.has_role(auth.uid(), 'manager'));

-- trip_attendees
CREATE TABLE IF NOT EXISTS public.trip_attendees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'going' CHECK (status IN ('going','not_going','maybe')),
  companions_count integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_trip_attendees" ON public.trip_attendees;
CREATE POLICY "auth_select_trip_attendees" ON public.trip_attendees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own_insert_trip_attendees" ON public.trip_attendees;
CREATE POLICY "own_insert_trip_attendees" ON public.trip_attendees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_update_trip_attendees" ON public.trip_attendees;
CREATE POLICY "own_update_trip_attendees" ON public.trip_attendees FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "own_delete_trip_attendees" ON public.trip_attendees;
CREATE POLICY "own_delete_trip_attendees" ON public.trip_attendees FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

-- trip_items
CREATE TABLE IF NOT EXISTS public.trip_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title       text NOT NULL,
  is_packed   boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_trip_items" ON public.trip_items;
CREATE POLICY "auth_select_trip_items" ON public.trip_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_trip_items" ON public.trip_items;
CREATE POLICY "auth_insert_trip_items" ON public.trip_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "own_update_trip_items" ON public.trip_items;
CREATE POLICY "own_update_trip_items" ON public.trip_items FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

DROP POLICY IF EXISTS "own_delete_trip_items" ON public.trip_items;
CREATE POLICY "own_delete_trip_items" ON public.trip_items FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

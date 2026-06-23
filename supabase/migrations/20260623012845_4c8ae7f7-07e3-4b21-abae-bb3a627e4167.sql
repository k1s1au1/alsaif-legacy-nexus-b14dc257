
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

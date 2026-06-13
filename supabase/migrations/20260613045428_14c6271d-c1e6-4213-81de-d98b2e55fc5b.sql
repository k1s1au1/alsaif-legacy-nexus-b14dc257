
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

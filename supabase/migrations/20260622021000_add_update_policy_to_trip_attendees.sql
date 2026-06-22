-- Allow users to update their own attendance status
CREATE POLICY "Users update own attendance status"
  ON public.trip_attendees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

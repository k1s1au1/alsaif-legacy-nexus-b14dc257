
-- 1) Drop plain-text password column from account_requests
ALTER TABLE public.account_requests DROP COLUMN IF EXISTS desired_password;

-- 2) Remove sensitive tables from supabase_realtime publication so postgres_changes
--    cannot broadcast their row changes to all authenticated subscribers
ALTER PUBLICATION supabase_realtime DROP TABLE public.bank_transfers;
ALTER PUBLICATION supabase_realtime DROP TABLE public.fund_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.meetings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_attendees;

-- 3) Add DELETE policy on trip-images storage bucket, mirroring UPDATE policy
CREATE POLICY "Admins and managers can delete trip images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);


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

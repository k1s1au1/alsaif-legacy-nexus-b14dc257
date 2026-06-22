-- Add status column to trip_attendees
ALTER TABLE public.trip_attendees ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('going', 'not_going')) DEFAULT 'going';

-- Set existing records to 'going'
UPDATE public.trip_attendees SET status = 'going' WHERE status IS NULL;

ALTER TABLE public.meeting_attendees ADD COLUMN companions_count INTEGER DEFAULT 0;
ALTER TABLE public.event_attendees ADD COLUMN companions_count INTEGER DEFAULT 0;

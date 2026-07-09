
DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();


-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: call send-push edge function
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _exclude uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
BEGIN
  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object('title', _title, 'body', _body, 'url', _url, 'exclude_user_id', _exclude)
  );
END;
$$;

-- Meetings notification
CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'اجتماع جديد',
    COALESCE(NEW.title,'تم إضافة اجتماع جديد'),
    '/meetings',
    NEW.created_by
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

-- Trips notification
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.call_send_push(
    'رحلة جديدة',
    COALESCE(NEW.title,'تم إضافة رحلة جديدة'),
    '/trips/'||NEW.id::text,
    NEW.created_by
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trips;
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

-- Chat message notification: notify participants of the conversation, exclude sender
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  SELECT COALESCE(full_name, arabic_name, 'رسالة جديدة') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND COALESCE(muted,false) = false;

  IF v_recipients IS NULL OR array_length(v_recipients,1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := CASE WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body,''), 100) ELSE '📎 مرفق' END;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object(
      'title', COALESCE(v_sender_name,'رسالة جديدة'),
      'body', v_preview,
      'url', '/chat/'||NEW.conversation_id::text,
      'user_ids', to_jsonb(v_recipients),
      'exclude_user_id', NEW.sender_id
    )
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

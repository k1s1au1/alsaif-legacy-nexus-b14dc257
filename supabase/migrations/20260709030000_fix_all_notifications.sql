
-- 1. Redefine the helper with the CORRECT project URL and Key provided by the user
-- Project: zqllblksdyutspauafgi
CREATE OR REPLACE FUNCTION public.call_send_push(_title text, _body text, _url text, _exclude uuid DEFAULT NULL, _user_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGxibGtzZHl1dHNwYXVhZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTc5MjUsImV4cCI6MjA5NzU5MzkyNX0.ZDD-xQ8RTprD-KSuePG4pGhhjh2kDp-YcGFr02cK3s4';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('title', _title, 'body', _body, 'url', _url);

  IF _exclude IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('exclude_user_id', _exclude);
  END IF;

  IF _user_ids IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('user_ids', to_jsonb(_user_ids));
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := v_payload
  );
END;
$$;

-- 2. Update Meetings Notification
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

-- 3. Update Trips Notification
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

-- 4. Create Tasks Notification (New)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Notify when a task is created with an assignee or when the assignee changes
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assignee_id IS NULL OR OLD.assignee_id <> NEW.assignee_id))) THEN
    -- Skip if the assignee is the one who did the action
    IF NEW.assignee_id <> auth.uid() THEN
      PERFORM public.call_send_push(
        'مهمة جديدة موكلة إليك',
        COALESCE(NEW.title, 'لديك مهمة جديدة بانتظار الإنجاز'),
        '/tasks',
        NULL,
        ARRAY[NEW.assignee_id]
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 5. Update Chat Notification (Fixing the call and ensuring recipients logic)
CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_sender_name text;
  v_recipients uuid[];
  v_preview text;
BEGIN
  -- Get sender name
  SELECT COALESCE(arabic_name, full_name, 'عضو العائلة') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Get other participants who haven't muted the conversation
  SELECT array_agg(user_id) INTO v_recipients
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND COALESCE(muted, false) = false;

  -- Only proceed if there are recipients
  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    v_preview := CASE
      WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 100)
      WHEN NEW.kind = 'image' THEN '📷 صورة'
      WHEN NEW.kind = 'video' THEN '🎬 فيديو'
      WHEN NEW.kind = 'audio' THEN '🎙 رسالة صوتية'
      ELSE '📎 مرفق'
    END;

    PERFORM public.call_send_push(
      v_sender_name,
      v_preview,
      '/chat/' || NEW.conversation_id::text,
      NEW.sender_id,
      v_recipients
    );
  END IF;

  RETURN NEW;
END; $$;

-- Re-apply message trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trg_notify_message_created ON public.messages;
CREATE TRIGGER trg_notify_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_message_created();

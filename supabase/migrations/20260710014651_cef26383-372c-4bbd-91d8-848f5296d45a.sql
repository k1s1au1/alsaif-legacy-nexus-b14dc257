CREATE OR REPLACE FUNCTION public.notify_task_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_endpoint text := 'https://zqllblksdyutspauafgi.supabase.co/functions/v1/send-push';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY';
  v_recipients uuid[];
BEGIN
  IF NEW.assignee_id IS NULL OR NEW.assignee_id = NEW.created_by THEN
    RETURN NEW;
  END IF;

  v_recipients := ARRAY[NEW.assignee_id];

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object(
      'title', '📋 مهمة جديدة',
      'body', COALESCE(NEW.title, 'تم إسناد مهمة جديدة إليك'),
      'url', '/tasks',
      'user_ids', to_jsonb(v_recipients),
      'exclude_user_id', NEW.created_by
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_task_created error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_created ON public.tasks;
CREATE TRIGGER trg_notify_task_created
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_created();
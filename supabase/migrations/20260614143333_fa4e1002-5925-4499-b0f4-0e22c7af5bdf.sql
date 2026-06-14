-- Archive items table for family photos/videos
CREATE TYPE public.archive_media_type AS ENUM ('image', 'video');

CREATE TABLE public.archive_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type public.archive_media_type NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_items TO authenticated;
GRANT ALL ON public.archive_items TO service_role;

ALTER TABLE public.archive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view archive"
  ON public.archive_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members can upload archive items"
  ON public.archive_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Owners or admins can update archive items"
  ON public.archive_items FOR UPDATE TO authenticated
  USING (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Owners or admins can delete archive items"
  ON public.archive_items FOR DELETE TO authenticated
  USING (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Enforce expiry cap of 60 days from creation, even if pinned is toggled off
CREATE OR REPLACE FUNCTION public.archive_enforce_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.created_at + INTERVAL '60 days' THEN
    NEW.expires_at := NEW.created_at + INTERVAL '60 days';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER archive_items_enforce_expiry
  BEFORE INSERT OR UPDATE ON public.archive_items
  FOR EACH ROW EXECUTE FUNCTION public.archive_enforce_expiry();

-- Storage bucket policies (bucket created via tool separately)
CREATE POLICY "Authenticated can view archive media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archive-media');

CREATE POLICY "Authenticated can upload archive media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners or admins can delete archive media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'archive-media' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Scheduled cleanup: delete expired non-pinned items daily at 03:00
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.archive_cleanup_expired()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.archive_items
  WHERE pinned = false AND expires_at <= now();
END;
$$;

SELECT cron.schedule(
  'archive-cleanup-expired-daily',
  '0 3 * * *',
  $$SELECT public.archive_cleanup_expired();$$
);

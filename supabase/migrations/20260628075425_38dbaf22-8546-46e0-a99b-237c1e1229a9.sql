
CREATE TABLE public.meeting_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slides','file','link')),
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_path TEXT,
  external_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_presentations TO authenticated;
GRANT ALL ON public.meeting_presentations TO service_role;

ALTER TABLE public.meeting_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view presentations"
  ON public.meeting_presentations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Meeting managers can insert"
  ON public.meeting_presentations FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_section(auth.uid(), 'meetings'));

CREATE POLICY "Meeting managers can update"
  ON public.meeting_presentations FOR UPDATE
  TO authenticated
  USING (public.can_manage_section(auth.uid(), 'meetings'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'meetings'));

CREATE POLICY "Meeting managers can delete"
  ON public.meeting_presentations FOR DELETE
  TO authenticated
  USING (public.can_manage_section(auth.uid(), 'meetings'));

CREATE TRIGGER trg_meeting_presentations_updated
BEFORE UPDATE ON public.meeting_presentations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_meeting_presentations_meeting ON public.meeting_presentations(meeting_id);

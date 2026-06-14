
-- Section enum
DO $$ BEGIN
  CREATE TYPE public.archive_section AS ENUM ('family','meetings','events','trips');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add column (default family for back-compat)
ALTER TABLE public.archive_items
  ADD COLUMN IF NOT EXISTS section public.archive_section NOT NULL DEFAULT 'family';

-- Allow expires_at to be null (non-family items don't expire)
ALTER TABLE public.archive_items ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.archive_items ALTER COLUMN expires_at DROP DEFAULT;

-- Replace expiry trigger: family => 3 days max; others => null
CREATE OR REPLACE FUNCTION public.archive_enforce_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.section = 'family' THEN
    IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.created_at + INTERVAL '3 days' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '3 days';
    END IF;
  ELSE
    NEW.expires_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Cleanup respects null expiry
CREATE OR REPLACE FUNCTION public.archive_cleanup_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.archive_items
  WHERE pinned = false
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

-- Refresh existing rows so they conform (they're all "family" by default)
UPDATE public.archive_items
SET expires_at = LEAST(COALESCE(expires_at, created_at + INTERVAL '3 days'), created_at + INTERVAL '3 days')
WHERE section = 'family';

-- Update RLS policies
DROP POLICY IF EXISTS "Members can upload archive items" ON public.archive_items;
DROP POLICY IF EXISTS "Owners or admins can update archive items" ON public.archive_items;
DROP POLICY IF EXISTS "Owners or admins can delete archive items" ON public.archive_items;

CREATE POLICY "Insert archive items by section rules"
ON public.archive_items
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploader_id
  AND (
    section = 'family'
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
  )
);

CREATE POLICY "Update archive items by section rules"
ON public.archive_items
FOR UPDATE TO authenticated
USING (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
)
WITH CHECK (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
);

CREATE POLICY "Delete archive items by section rules"
ON public.archive_items
FOR DELETE TO authenticated
USING (
  CASE WHEN section = 'family'
    THEN auth.uid() = uploader_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    ELSE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  END
);

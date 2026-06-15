
-- Add parent linkage for family tree
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_parent_id_idx ON public.profiles(parent_id);

-- Auto-link parent on insert/update by matching names:
-- A profile's parent is another profile whose first_name == this.father_name
-- AND father_name == this.grandfather_name.
CREATE OR REPLACE FUNCTION public.profiles_auto_link_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent uuid;
BEGIN
  -- Only auto-fill when parent is not already set
  IF NEW.parent_id IS NULL AND NEW.father_name IS NOT NULL THEN
    SELECT p.id INTO v_parent
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND p.first_name IS NOT NULL
      AND btrim(p.first_name) = btrim(NEW.father_name)
      AND (
        NEW.grandfather_name IS NULL
        OR p.father_name IS NULL
        OR btrim(p.father_name) = btrim(NEW.grandfather_name)
      )
    ORDER BY (CASE WHEN p.father_name IS NOT NULL
                   AND btrim(p.father_name) = btrim(COALESCE(NEW.grandfather_name,''))
                   THEN 0 ELSE 1 END)
    LIMIT 1;

    NEW.parent_id := v_parent;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_auto_link_parent_trg ON public.profiles;
CREATE TRIGGER profiles_auto_link_parent_trg
BEFORE INSERT OR UPDATE OF first_name, father_name, grandfather_name
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_auto_link_parent();

-- Backfill existing rows
UPDATE public.profiles me
SET parent_id = parent.id
FROM public.profiles parent
WHERE me.parent_id IS NULL
  AND me.father_name IS NOT NULL
  AND parent.id <> me.id
  AND parent.first_name IS NOT NULL
  AND btrim(parent.first_name) = btrim(me.father_name)
  AND (
    me.grandfather_name IS NULL
    OR parent.father_name IS NULL
    OR btrim(parent.father_name) = btrim(me.grandfather_name)
  );


-- Remove the strict requirement that every profile must have an auth user
-- This allows adding family members to the tree without giving them app access
ALTER TABLE IF EXISTS public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Ensure the ID column remains but is no longer tied to auth.users
ALTER TABLE public.profiles
ALTER COLUMN id SET DEFAULT gen_random_uuid();

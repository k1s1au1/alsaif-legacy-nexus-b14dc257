-- Allow each trip to define its own accommodation type.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS accommodation_type text NOT NULL DEFAULT 'مخيم عائلي فاخر';

NOTIFY pgrst, 'reload schema';

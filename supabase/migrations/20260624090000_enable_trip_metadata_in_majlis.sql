
-- Final robust solution: Use the existing majlis_posts table with a special title prefix for trip items
-- This bypasses all schema cache issues because majlis_posts is already well-cached.

-- Ensure RLS on majlis_posts is ready for this (it should be already from previous fixes)
-- We don't need to change the schema, just use it.
NOTIFY pgrst, 'reload schema';

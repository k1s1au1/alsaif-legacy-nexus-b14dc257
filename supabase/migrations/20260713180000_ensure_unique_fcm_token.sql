
-- Ensure that each FCM token is associated with only one active record (the latest user)
-- This prevents a device from receiving duplicate notifications or notifications for multiple users.

-- 1. Remove any duplicate tokens before adding the constraint
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.id < b.id
  AND a.token = b.token;

-- 2. Add a unique constraint on the token column if it doesn't exist
-- First, drop any existing unique constraint on (user_id, token) that might interfere with a global token uniqueness
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

-- 3. Create a unique index on token
DROP INDEX IF EXISTS push_tokens_token_idx;
CREATE UNIQUE INDEX push_tokens_token_unique_idx ON public.push_tokens (token);

-- 4. Update the upsert logic in our heads
-- (The client code already uses { onConflict: 'token' })

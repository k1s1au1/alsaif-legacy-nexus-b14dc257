-- Keep legacy tokens working while allowing the current Android app to register its Firebase token.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.push_tokens
SET user_id = old_user_id::uuid
WHERE user_id IS NULL
  AND old_user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_id_token_key
  ON public.push_tokens (user_id, token)
  WHERE user_id IS NOT NULL;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_tokens'
      AND policyname = 'users manage current push tokens'
  ) THEN
    CREATE POLICY "users manage current push tokens"
      ON public.push_tokens
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $;
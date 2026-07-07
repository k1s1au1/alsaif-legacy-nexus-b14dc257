
CREATE TABLE public.secure_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  storage_path TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  unlock_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.secure_vault TO authenticated;
GRANT ALL ON public.secure_vault TO service_role;

ALTER TABLE public.secure_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their vault items"
  ON public.secure_vault FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their vault items"
  ON public.secure_vault FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their vault items"
  ON public.secure_vault FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their vault items"
  ON public.secure_vault FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX idx_secure_vault_owner ON public.secure_vault(owner_id);

-- Storage policies for vault-media bucket (files stored under <owner_id>/...)
CREATE POLICY "Vault owners can read their files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can upload their files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can update their files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vault owners can delete their files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault-media' AND auth.uid()::text = (storage.foldername(name))[1]);

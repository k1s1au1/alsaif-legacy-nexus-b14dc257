ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS desired_password TEXT;
DELETE FROM public.account_requests WHERE email IS NULL;
ALTER TABLE public.account_requests ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

ALTER TABLE public.fund_transactions
DROP CONSTRAINT IF EXISTS fund_transactions_created_by_fkey;

ALTER TABLE public.fund_transactions
ADD CONSTRAINT fund_transactions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
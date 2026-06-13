
-- Enable realtime
ALTER TABLE public.fund_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_transactions;

-- Duplicate guard: reject identical tx from same user within 5 seconds
CREATE OR REPLACE FUNCTION public.prevent_duplicate_fund_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fund_transactions
    WHERE created_by = NEW.created_by
      AND type = NEW.type
      AND amount = NEW.amount
      AND COALESCE(description,'') = COALESCE(NEW.description,'')
      AND created_at > now() - interval '5 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate transaction detected, please wait a few seconds';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_fund_tx_trigger ON public.fund_transactions;
CREATE TRIGGER prevent_duplicate_fund_tx_trigger
BEFORE INSERT ON public.fund_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_fund_tx();


-- Status enum
DO $$ BEGIN
  CREATE TYPE public.bank_transfer_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  sender_name TEXT NOT NULL,
  reference_number TEXT,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_url TEXT,
  note TEXT,
  status public.bank_transfer_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  fund_transaction_id UUID REFERENCES public.fund_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate prevention: same reference number cannot exist twice
CREATE UNIQUE INDEX IF NOT EXISTS bank_transfers_reference_unique
  ON public.bank_transfers (reference_number)
  WHERE reference_number IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS bank_transfers_status_idx ON public.bank_transfers(status);
CREATE INDEX IF NOT EXISTS bank_transfers_submitted_by_idx ON public.bank_transfers(submitted_by);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.bank_transfers TO authenticated;
GRANT ALL ON public.bank_transfers TO service_role;

-- RLS
ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own transfers"
  ON public.bank_transfers FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Members create own transfers"
  ON public.bank_transfers FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "Admins update transfers"
  ON public.bank_transfers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- updated_at trigger
CREATE TRIGGER bank_transfers_set_updated_at
  BEFORE UPDATE ON public.bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On approval: auto-create matching fund_transactions row and link it
CREATE OR REPLACE FUNCTION public.bank_transfer_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_desc TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.fund_transaction_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    v_desc := 'تحويل بنكي من ' || NEW.sender_name ||
              CASE WHEN NEW.reference_number IS NOT NULL
                   THEN ' (مرجع: ' || NEW.reference_number || ')'
                   ELSE '' END;

    INSERT INTO public.fund_transactions (type, amount, description, occurred_at, created_by)
    VALUES ('contribution', NEW.amount, v_desc, NEW.transferred_at, NEW.submitted_by)
    RETURNING id INTO v_tx_id;

    NEW.fund_transaction_id := v_tx_id;
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  -- On revert from approved → remove linked fund transaction
  IF OLD.status = 'approved' AND NEW.status <> 'approved' AND OLD.fund_transaction_id IS NOT NULL THEN
    DELETE FROM public.fund_transactions WHERE id = OLD.fund_transaction_id;
    NEW.fund_transaction_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_transfer_on_approve_trigger ON public.bank_transfers;
CREATE TRIGGER bank_transfer_on_approve_trigger
  BEFORE UPDATE ON public.bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.bank_transfer_on_approve();

-- Realtime
ALTER TABLE public.bank_transfers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transfers;

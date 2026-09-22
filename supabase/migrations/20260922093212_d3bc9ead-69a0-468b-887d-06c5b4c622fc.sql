ALTER TABLE public.bill_accounts
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS current_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS apr numeric,
  ADD COLUMN IF NOT EXISTS promo_end_date date;

ALTER TABLE public.bill_accounts
  DROP CONSTRAINT IF EXISTS bill_accounts_account_kind_check;
ALTER TABLE public.bill_accounts
  ADD CONSTRAINT bill_accounts_account_kind_check
  CHECK (account_kind IN ('current', 'savings', 'credit_card'));

CREATE TABLE IF NOT EXISTS public.financial_advice_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label text NOT NULL,
  context_note text,
  summary_snapshot jsonb,
  advice_markdown text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_advice_runs TO authenticated;
GRANT ALL ON public.financial_advice_runs TO service_role;

ALTER TABLE public.financial_advice_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on financial_advice_runs for authenticated users" ON public.financial_advice_runs;
CREATE POLICY "Allow all operations on financial_advice_runs for authenticated users"
  ON public.financial_advice_runs FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_financial_advice_runs_updated_at ON public.financial_advice_runs;
CREATE TRIGGER update_financial_advice_runs_updated_at
  BEFORE UPDATE ON public.financial_advice_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
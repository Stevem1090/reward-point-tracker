CREATE TABLE public.bill_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_accounts TO authenticated;
GRANT ALL ON public.bill_accounts TO service_role;
ALTER TABLE public.bill_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on bill_accounts for authenticated users" ON public.bill_accounts FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE public.incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expiry_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomes TO authenticated;
GRANT ALL ON public.incomes TO service_role;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on incomes for authenticated users" ON public.incomes FOR ALL USING (auth.role() = 'authenticated');
CREATE TRIGGER update_incomes_updated_at BEFORE UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bills
  ADD COLUMN custom_count integer,
  ADD COLUMN expiry_date date,
  ADD COLUMN account_id uuid REFERENCES public.bill_accounts(id) ON DELETE SET NULL;
CREATE TABLE public.committed_spending_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL DEFAULT public.current_family_id() REFERENCES public.families(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.bill_accounts(id) ON DELETE CASCADE,
  pay_period text NOT NULL,
  parent_id uuid REFERENCES public.committed_spending_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  estimate_min numeric,
  estimate_max numeric,
  is_range boolean NOT NULL DEFAULT false,
  actual_amount numeric,
  is_complete boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.committed_spending_items TO authenticated;
GRANT ALL ON public.committed_spending_items TO service_role;
ALTER TABLE public.committed_spending_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "same family" ON public.committed_spending_items FOR ALL TO authenticated
  USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());
CREATE INDEX ON public.committed_spending_items (family_id, pay_period, account_id);
CREATE TRIGGER committed_spending_updated BEFORE UPDATE ON public.committed_spending_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
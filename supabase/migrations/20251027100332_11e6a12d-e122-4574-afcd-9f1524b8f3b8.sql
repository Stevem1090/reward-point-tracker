-- Create bill_types table
CREATE TABLE public.bill_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bill_types
ALTER TABLE public.bill_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bill_types
CREATE POLICY "Allow all operations on bill_types for authenticated users"
  ON public.bill_types
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create bills table
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bill_type_id UUID REFERENCES public.bill_types(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  payment_day INTEGER DEFAULT 1 CHECK (payment_day >= 1 AND payment_day <= 31),
  payment_date DATE,
  weekly_days TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bills
CREATE POLICY "Allow all operations on bills for authenticated users"
  ON public.bills
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_bills_bill_type_id ON public.bills(bill_type_id);
CREATE INDEX idx_bills_frequency ON public.bills(frequency);
CREATE INDEX idx_bills_active ON public.bills(active);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bills_updated_at();
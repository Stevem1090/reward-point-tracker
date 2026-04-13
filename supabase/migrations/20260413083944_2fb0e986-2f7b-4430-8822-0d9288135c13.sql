ALTER TABLE public.meals DROP CONSTRAINT meals_status_check;
ALTER TABLE public.meals ADD CONSTRAINT meals_status_check 
  CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected', 'skipped']));
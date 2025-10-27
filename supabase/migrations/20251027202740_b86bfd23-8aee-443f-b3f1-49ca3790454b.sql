-- Drop the old constraint that doesn't include 'one-time'
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_frequency_check;

-- Add the new constraint with 'one-time' included
ALTER TABLE bills ADD CONSTRAINT bills_frequency_check 
CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'one-time'::text]));
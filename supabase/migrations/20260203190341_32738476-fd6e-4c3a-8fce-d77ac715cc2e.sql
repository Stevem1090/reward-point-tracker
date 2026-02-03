-- Add rejection_reason column to meals table
-- This stores the reason code when a meal is rejected (e.g., 'had_recently', 'too_complex')
ALTER TABLE meals 
ADD COLUMN rejection_reason TEXT;